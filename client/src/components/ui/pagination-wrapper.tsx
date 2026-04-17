"use client";

import { Pagination, Typography } from '@heroui/react';

interface PaginationWrapperProps {
  page: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export const PaginationWrapper: React.FC<PaginationWrapperProps> = ({
  page,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}) => {
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (page > 3) {
        pages.push("ellipsis");
      }

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) {
        pages.push("ellipsis");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const startItem = totalItems === 0 ? 0 : (page - 1) * itemsPerPage + 1;
  const endItem = Math.min(page * itemsPerPage, totalItems);

  return (
    <Pagination
      aria-label="Pagination navigation"
      className="w-full flex flex-col sm:flex-row items-center justify-between select-none"
    >
      <Pagination.Summary>
        <Typography type="body-xs" className="text-muted font-medium">
          Showing {startItem}-{endItem} of {totalItems} results
        </Typography>
      </Pagination.Summary>
      <Pagination.Content className="flex items-center gap-1">
        <Pagination.Item>
          <Pagination.Previous
            isDisabled={page === 1}
            onPress={() => onPageChange(Math.max(1, page - 1))}
            className="cursor-pointer font-bold text-xs focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden"
            aria-label="Previous page"
          >
            <Pagination.PreviousIcon />
            <span className="hidden sm:inline">Previous</span>
          </Pagination.Previous>
        </Pagination.Item>
        {getPageNumbers().map((p, i) =>
          p === "ellipsis" ? (
            <Pagination.Item key={`ellipsis-${i}`}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={p}>
              <Pagination.Link
                isActive={p === page}
                onPress={() => onPageChange(p)}
                className="cursor-pointer text-xs font-semibold focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden"
              >
                {p}
              </Pagination.Link>
            </Pagination.Item>
          )
        )}
        <Pagination.Item>
          <Pagination.Next
            isDisabled={page === totalPages || totalPages === 0}
            onPress={() => onPageChange(Math.min(totalPages, page + 1))}
            className="cursor-pointer font-bold text-xs focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden"
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
};

export default PaginationWrapper;
