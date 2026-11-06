import { useEffect } from "react";
import type { Pagination } from "../../shared/api/types";
import { clampPage } from "./catalogRules";

export function useClampedPage(pagination: Pagination | undefined, page: number, setPage: (page: number) => void) {
  const totalPages = pagination?.totalPages;

  useEffect(() => {
    if (totalPages !== undefined && clampPage(page, totalPages) !== page) {
      setPage(clampPage(page, totalPages));
    }
  }, [totalPages, page, setPage]);
}
