import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn("flex min-w-0 flex-col gap-6 border-0 p-0", className)}
      {...props}
    />
  );
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "font-heading font-medium text-foreground",
        variant === "legend" ? "text-base" : "text-sm",
        className,
      )}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("@container/field-group flex min-w-0 flex-col gap-6", className)}
      {...props}
    />
  );
}

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "vertical" | "horizontal" | "responsive";
}) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(
        "min-w-0 gap-2 data-[orientation=vertical]:flex data-[orientation=vertical]:flex-col",
        "data-[orientation=horizontal]:grid data-[orientation=horizontal]:grid-cols-[auto_1fr] data-[orientation=horizontal]:items-start data-[orientation=horizontal]:gap-x-3",
        "data-[orientation=responsive]:flex data-[orientation=responsive]:flex-col @md/field-group:data-[orientation=responsive]:grid @md/field-group:data-[orientation=responsive]:grid-cols-[minmax(10rem,0.75fr)_minmax(0,1.25fr)] @md/field-group:data-[orientation=responsive]:items-start @md/field-group:data-[orientation=responsive]:gap-x-6",
        className,
      )}
      {...props}
    />
  );
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn("min-w-0 leading-5", className)}
      {...props}
    />
  );
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-title"
      className={cn("text-sm font-medium leading-5 text-foreground", className)}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-xs leading-5 text-muted-foreground", className)}
      {...props}
    />
  );
}

function FieldError({
  className,
  errors,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const messages = errors?.flatMap((error) => (error?.message ? [error.message] : [])) ?? [];
  const content = children ?? (messages.length > 1 ? (
    <ul className="list-disc pl-4">
      {messages.map((message) => <li key={message}>{message}</li>)}
    </ul>
  ) : messages[0]);

  if (!content) return null;

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("text-xs leading-5 text-destructive", className)}
      {...props}
    >
      {content}
    </div>
  );
}

function FieldSeparator({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-separator"
      className={cn("flex items-center gap-3 text-xs text-muted-foreground", className)}
      {...props}
    >
      <span className="h-px flex-1 bg-border" />
      {children ? <span>{children}</span> : null}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
};
