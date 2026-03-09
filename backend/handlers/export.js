const { doc, TABLES, requireMember } = require("../db");
const { json, raw, badRequest, forbidden } = require("../responses");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseExportRange(query) {
  const startDate = query && query.startDate;
  const endDate = query && query.endDate;
  if (!startDate || !endDate) return { err: "startDate and endDate (YYYY-MM-DD) are required" };
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) return { err: "startDate and endDate must be YYYY-MM-DD" };
  if (startDate > endDate) return { err: "startDate must be before endDate" };
  return { skStart: `${startDate}#`, skEnd: `${endDate}\uffff` };
}

function buildFilterDescription(query) {
  const parts = [`Period: ${query.startDate || ""} to ${query.endDate || ""}`];
  const paymentMode = query.paymentMode !== undefined ? query.paymentMode : query.payment_mode;
  const transactionType = query.transactionType !== undefined ? query.transactionType : query.transaction_type;
  if (paymentMode !== undefined && paymentMode !== null) {
    parts.push(String(paymentMode).trim() === "" ? "Payment: (none)" : `Payment: ${paymentMode}`);
  }
  if (transactionType === "credit" || transactionType === "debit") {
    parts.push(`Type: ${transactionType}`);
  }
  return parts.join(" | ");
}

const USER_CATEGORIES_PREFIX = "USER#";

async function fetchCategoryNamesForUser(userId) {
  const gid = USER_CATEGORIES_PREFIX + userId;
  const out = [];
  let lastKey;
  do {
    const params = {
      TableName: TABLES.categories,
      KeyConditionExpression: "groupId = :gid",
      ExpressionAttributeValues: { ":gid": gid },
    };
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const r = await doc.query(params).promise();
    out.push(...(r.Items || []));
    lastKey = r.LastEvaluatedKey;
  } while (lastKey);
  const categoryIdToName = {};
  out.filter((c) => !c.archived).forEach((c) => {
    categoryIdToName[c.categoryId] = c.name;
  });
  return { categoryIdToName };
}

async function fetchTransactions(groupId, userId, query) {
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return { err: forbidden("Not a member of this group") };
  const range = parseExportRange(query);
  if (range.err) return { err: badRequest(range.err) };
  const req = {
    TableName: TABLES.transactions,
    KeyConditionExpression: "groupId = :gid AND sk BETWEEN :start AND :end",
    ExpressionAttributeValues: { ":gid": groupId, ":start": range.skStart, ":end": range.skEnd },
  };
  const paymentMode = query.paymentMode !== undefined ? query.paymentMode : query.payment_mode;
  const transactionType = query.transactionType !== undefined ? query.transactionType : query.transaction_type;
  const filters = [];
  const names = {};
  if (paymentMode !== undefined && paymentMode !== null) {
    const pm = String(paymentMode).trim();
    if (pm !== "") {
      filters.push("#pm = :pm");
      names["#pm"] = "paymentMode";
      req.ExpressionAttributeValues[":pm"] = pm;
    } else {
      filters.push("(attribute_not_exists(#pm) OR #pm = :pm)");
      names["#pm"] = "paymentMode";
      req.ExpressionAttributeValues[":pm"] = "";
    }
  }
  if (transactionType === "credit" || transactionType === "debit") {
    names["#txType"] = "transactionType";
    req.ExpressionAttributeValues[":tt"] = transactionType;
    if (transactionType === "debit") {
      filters.push("(attribute_not_exists(#txType) OR #txType = :tt)");
    } else {
      filters.push("#txType = :tt");
    }
  }
  if (filters.length) {
    req.FilterExpression = filters.join(" AND ");
    if (Object.keys(names).length) req.ExpressionAttributeNames = names;
  }
  const r = await doc.query(req).promise();
  return { transactions: r.Items || [] };
}

function csvEscape(s) {
  if (s == null) return "";
  const t = String(s);
  if (/[",\n\r]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
  return t;
}

async function csv(params, body, userId, query) {
  const { groupId } = params;
  const [txResult, catResult] = await Promise.all([
    fetchTransactions(groupId, userId, query),
    fetchCategoryNamesForUser(userId),
  ]);
  if (txResult.err) return txResult.err;
  const rows = txResult.transactions;
  const categoryIdToName = catResult.categoryIdToName || {};
  const filterLine = "# Filter: " + buildFilterDescription(query) + "\n";
  const header = "Date,Type,Amount (INR),Category,Payment,Note\n";
  const bodyRows = rows.map((t) => {
    const type = t.transactionType === "credit" ? "credit" : "debit";
    const categoryName = (t.categoryId && categoryIdToName[t.categoryId]) || t.categoryId || "";
    return [t.date, type, t.amount, categoryName, t.paymentMode || "", t.note || ""].map(csvEscape).join(",");
  }).join("\n");
  const csvBody = filterLine + header + bodyRows;
  const filename = `saven-export-${params.groupId}-${query.startDate || "range"}.csv`;
  return raw(200, csvBody, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
}

async function pdf(params, body, userId, query) {
  const { groupId } = params;
  const [txResult, catResult] = await Promise.all([
    fetchTransactions(groupId, userId, query),
    fetchCategoryNamesForUser(userId),
  ]);
  if (txResult.err) return txResult.err;
  const rows = txResult.transactions;
  const categoryIdToName = catResult.categoryIdToName || {};
  let PDFDocument;
  try {
    PDFDocument = require("pdfkit");
  } catch (e) {
    console.error("pdfkit not installed", e);
    return json(501, { error: "NotImplemented", message: "PDF export not available" });
  }
  const docPdf = new PDFDocument({ margin: 50 });
  const chunks = [];
  docPdf.on("data", (chunk) => chunks.push(chunk));
  docPdf.on("end", () => {});
  docPdf.fontSize(16).text("Saven – Transaction export", { continued: false });
  docPdf.fontSize(9).text("Filter: " + buildFilterDescription(query), { continued: false });
  docPdf.moveDown();
  docPdf.fontSize(10);
  const tableTop = docPdf.y;
  docPdf.text("Date", 50, tableTop);
  docPdf.text("Type", 100, tableTop);
  docPdf.text("Amount (INR)", 140, tableTop);
  docPdf.text("Category", 200, tableTop);
  docPdf.text("Payment", 280, tableTop);
  docPdf.text("Note", 340, tableTop);
  let y = tableTop + 15;
  for (const t of rows) {
    const type = t.transactionType === "credit" ? "credit" : "debit";
    const categoryName = (t.categoryId && categoryIdToName[t.categoryId]) || t.categoryId || "";
    docPdf.text(t.date || "", 50, y);
    docPdf.text(type, 100, y);
    docPdf.text(String(t.amount ?? ""), 140, y);
    docPdf.text((categoryName || "").slice(0, 18), 200, y);
    docPdf.text((t.paymentMode || "").slice(0, 8), 280, y);
    docPdf.text((t.note || "").slice(0, 20), 340, y);
    y += 14;
    if (y > 700) {
      docPdf.addPage();
      y = 50;
    }
  }
  docPdf.end();

  const buffer = await new Promise((resolve, reject) => {
    docPdf.on("end", () => resolve(Buffer.concat(chunks)));
    docPdf.on("error", reject);
  });
  const filename = `saven-export-${groupId}-${query.startDate || "range"}.pdf`;
  return raw(200, buffer, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
}

module.exports = { csv, pdf };
