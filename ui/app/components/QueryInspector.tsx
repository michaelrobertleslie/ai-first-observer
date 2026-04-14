import React, { useState, useCallback } from "react";
import { Button } from "@dynatrace/strato-components/buttons";
import { Sheet } from "@dynatrace/strato-components/overlays";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Paragraph } from "@dynatrace/strato-components/typography";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";

/**
 * A small "⟨/⟩ DQL" button that opens a Sheet showing the raw DQL query
 * behind a card. Users can copy the query and paste into Dynatrace Notebooks
 * for independent verification.
 */
export function QueryInspector({
  query,
  title,
}: {
  query: string;
  title?: string;
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(query).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [query]);

  return (
    <>
      <button
        onClick={() => setShow(true)}
        title="Inspect the DQL query behind this data"
        style={{
          padding: "3px 8px",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          borderRadius: 4,
          border: `1px solid ${Colors.Charts.Apdex.Fair.Default}`,
          color: Colors.Charts.Apdex.Fair.Default,
          background: "transparent",
          fontFamily: "monospace",
          lineHeight: 1.4,
        }}
      >
        ⟨/⟩ DQL
      </button>

      <Sheet
        title={title ?? "DQL Query Inspector"}
        show={show}
        onDismiss={() => setShow(false)}
        actions={
          <Button variant="emphasized" onClick={() => setShow(false)}>
            Close
          </Button>
        }
      >
        <Flex flexDirection="column" gap={16} padding={8}>
          <Paragraph style={{ opacity: 0.6, fontSize: 12 }}>
            This is the exact DQL query executed against the Grail data
            lakehouse. Copy it into a Dynatrace Notebook to explore the data
            interactively.
          </Paragraph>

          <pre
            style={{
              background: "#1a1a2e",
              color: "#e6e6e6",
              padding: 16,
              borderRadius: 6,
              fontSize: 12,
              lineHeight: 1.6,
              overflow: "auto",
              maxHeight: 400,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {query}
          </pre>

          <Flex gap={8}>
            <Button onClick={handleCopy}>
              {copied ? "✓ Copied" : "Copy to clipboard"}
            </Button>
            <a
              href={`${getEnvironmentUrl()}/ui/apps/dynatrace.notebooks/`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                borderRadius: 4,
                border: `1px solid ${Colors.Charts.Apdex.Good.Default}`,
                color: Colors.Charts.Apdex.Good.Default,
                background: "transparent",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Open Notebooks ↗
            </a>
          </Flex>

          <Paragraph style={{ opacity: 0.35, fontSize: 11 }}>
            Paste the DQL into a new Notebook section to run it yourself and
            verify the results.
          </Paragraph>
        </Flex>
      </Sheet>
    </>
  );
}
