import { Box, CircularProgress } from "@mui/material";

/**
 * Centered loading spinner. Use for page/section loads.
 * @param {object} props
 * @param {string} [props.label] - Optional text below the spinner
 * @param {boolean} [props.inline] - If true, compact inline layout (e.g. for a table section)
 */
export default function LoadingSpinner({ label, inline }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        py: inline ? 2 : 6,
        px: 2,
      }}
      role="status"
      aria-label={label || "Loading"}
    >
      <CircularProgress size={inline ? 32 : 40} color="primary" />
      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </Box>
  );
}
