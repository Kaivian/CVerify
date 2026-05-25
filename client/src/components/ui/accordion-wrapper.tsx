"use client";

import React from 'react';
import { Accordion, Typography } from '@heroui/react';
import { ChevronDown } from 'lucide-react';

interface AccordionItemData {
  id: string;
  title: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
}

interface AccordionWrapperProps {
  items: AccordionItemData[];
  className?: string;
  variant?: 'surface' | 'default';
  allowsMultipleExpanded?: boolean;
  expandedKeys?: Set<string | number>;
  onExpandedChange?: (keys: unknown) => void;
}

export const AccordionWrapper: React.FC<AccordionWrapperProps> = ({
  items,
  className = "w-full",
  variant = "surface",
  allowsMultipleExpanded = true,
  expandedKeys,
  onExpandedChange,
}) => {
  return (
    <Accordion
      className={className}
      variant={variant}
      allowsMultipleExpanded={allowsMultipleExpanded}
      expandedKeys={expandedKeys}
      onExpandedChange={onExpandedChange}
    >
      {items.map((item) => (
        <Accordion.Item key={item.id} id={item.id} className="border-border">
          <Accordion.Heading>
            <Accordion.Trigger className="w-full flex items-center justify-between py-4 px-5 text-sm font-bold text-foreground select-none cursor-pointer outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-hidden">
              <div className="flex items-center gap-3">
                {item.icon && <span className="text-muted size-4">{item.icon}</span>}
                <Typography type="body-sm" className="font-bold text-foreground">
                  {item.title}
                </Typography>
              </div>
              <Accordion.Indicator className="text-muted transition-transform duration-200 ease-out">
                <ChevronDown size={16} />
              </Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="px-5 pb-5 text-xs md:text-sm text-muted-foreground leading-relaxed border-t border-separator pt-4 bg-surface-secondary">
              {item.content}
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
};

export default AccordionWrapper;
