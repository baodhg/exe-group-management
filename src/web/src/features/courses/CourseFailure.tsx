import { ArrowLeft } from "lucide-react";
import { ApiError } from "../../shared/api/apiClient";
import { Failure, LinkButton, Section } from "../common/ui";

export function CourseFailure({
  error,
  onRetry,
  failTitle,
  forbiddenText,
  missingText,
  backTo,
  backLabel,
}: {
  error: unknown;
  onRetry: () => void;
  failTitle: string;
  forbiddenText: string;
  missingText: string;
  backTo: string;
  backLabel: string;
}) {
  const status = error instanceof ApiError ? error.status : 0;
  const title = status === 403 ? forbiddenText : status === 404 ? missingText : failTitle;
  const final = status === 403 || status === 404;

  return (
    <Section className="mt-5">
      <Failure
        error={error}
        title={title}
        onRetry={final ? undefined : onRetry}
        action={
          <LinkButton to={backTo} variant="outline" size="sm">
            <ArrowLeft />
            {backLabel}
          </LinkButton>
        }
      />
    </Section>
  );
}
