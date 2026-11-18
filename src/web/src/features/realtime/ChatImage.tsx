import { useEffect, useState } from "react";
import { useAuth } from "../../shared/auth/useAuth";
import type { ChatAttachment } from "./chat";

export function ChatImage({ attachment }: { attachment: ChatAttachment }) {
  const { api } = useAuth();
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let alive = true;
    setFailed(false);

    api
      .blob(attachment.url)
      .then((blob) => {
        if (!alive) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => {
        if (alive) {
          setFailed(true);
        }
      });

    return () => {
      alive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [api, attachment.url]);

  if (failed) {
    return <span className="text-xs italic opacity-70">Không tải được ảnh</span>;
  }

  if (!source) {
    return <span className="size-32 animate-pulse rounded-lg bg-black/10" aria-label="Đang tải ảnh" />;
  }

  return <img src={source} alt={attachment.fileName} className="max-h-48 max-w-[220px] rounded-lg object-cover" />;
}
