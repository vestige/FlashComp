import { useEffect } from "react";

const APP_NAME = "FLASH FLASH コンペ";

export function usePageTitle(pageTitle) {
  useEffect(() => {
    const normalized = pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME;
    document.title = normalized;
  }, [pageTitle]);
}

