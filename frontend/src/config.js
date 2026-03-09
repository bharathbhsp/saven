// App name: "SavenDev" when running locally (npm run dev) or when VITE_APP_NAME=SavenDev / deploy-frontend.sh dev; "Saven" for prod.
export const APP_NAME =
  import.meta.env.VITE_APP_NAME ||
  (import.meta.env.DEV ? "SavenDev" : "Saven");
