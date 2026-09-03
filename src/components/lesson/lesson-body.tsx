import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// react-markdown injects a `node` (mdast) prop into every custom component;
// dropping it here keeps it from leaking onto the underlying DOM element as
// an invalid node="[object Object]" attribute.
function omitNode<P extends { node?: unknown }>(props: P): Omit<P, "node"> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

const components: Components = {
  h1: (props) => {
    const { className, ...rest } = omitNode(props);
    return (
      <h2 className={cn("mt-10 text-3xl font-bold tracking-tight first:mt-0", className)} {...rest} />
    );
  },
  h2: (props) => {
    const { className, ...rest } = omitNode(props);
    return (
      <h2 className={cn("mt-10 text-3xl font-bold tracking-tight first:mt-0", className)} {...rest} />
    );
  },
  h3: (props) => {
    const { className, ...rest } = omitNode(props);
    return <h3 className={cn("mt-8 text-xl font-bold tracking-tight", className)} {...rest} />;
  },
  p: (props) => {
    const { className, ...rest } = omitNode(props);
    return <p className={cn("mt-4 text-base leading-relaxed first:mt-0", className)} {...rest} />;
  },
  ul: (props) => {
    const { className, ...rest } = omitNode(props);
    return <ul className={cn("mt-4 list-disc space-y-2 pl-6", className)} {...rest} />;
  },
  ol: (props) => {
    const { className, ...rest } = omitNode(props);
    return <ol className={cn("mt-4 list-decimal space-y-2 pl-6", className)} {...rest} />;
  },
  li: (props) => {
    const { className, ...rest } = omitNode(props);
    return <li className={cn("leading-relaxed", className)} {...rest} />;
  },
  blockquote: (props) => {
    const { className, ...rest } = omitNode(props);
    return (
      <blockquote
        className={cn("mt-4 border-l-2 border-violet pl-4 text-graphite italic", className)}
        {...rest}
      />
    );
  },
  code: (props) => {
    const { className, ...rest } = omitNode(props);
    const isBlock = className?.includes("language-");
    return (
      <code
        className={cn(
          isBlock ? "text-sm" : "rounded bg-pale-lilac px-1.5 py-0.5 text-sm",
          className,
        )}
        {...rest}
      />
    );
  },
  pre: (props) => {
    const { className, ...rest } = omitNode(props);
    return (
      <pre className={cn("mt-4 overflow-x-auto rounded-md bg-pale-lilac p-4", className)} {...rest} />
    );
  },
  a: (props) => {
    const { className, ...rest } = omitNode(props);
    return <a className={cn("text-violet underline underline-offset-2", className)} {...rest} />;
  },
};

export function LessonBody({ content }: { content: string }) {
  return (
    <div className="max-w-[68ch] rounded-md border border-border bg-paper p-8">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
