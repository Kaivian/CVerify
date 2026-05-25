import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  glow = true,
  ...props
}) => {
  return (
    <div
      {...props}
      className={[
        "relative overflow-hidden w-full rounded-2xl p-6 sm:p-8 transition-all duration-300",
        "bg-surface text-foreground",
        "border border-border/60",
        // Premium drop shadows and glowing border effects
        glow
          ? "shadow-surface before:absolute before:inset-0 before:rounded-2xl before:p-px before:bg-linear-to-b before:from-border/40 before:to-transparent before:-z-10"
          : "shadow-sm",
        className
      ].join(' ')}
    >
      {/* Decorative subtle top glow inside the card */}
      {glow && (
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-linear-to-r from-transparent via-border/30 to-transparent pointer-events-none" />
      )}

      <div className="relative z-10 flex flex-col h-full w-full">
        {children}
      </div>
    </div>
  );
};
