type AttachmentListItem = {
  id: string;
  url: string;
  original_name: string;
  mime_type: string;
};

type AttachmentListProps = {
  attachments: AttachmentListItem[];
};

export function AttachmentList({ attachments }: AttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {attachments.map((attachment) => {
        const isImage = attachment.mime_type.startsWith("image/");

        return (
          <li key={attachment.id} className="hb-card hb-card-muted overflow-hidden">
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              {isImage ? (
                <img
                  src={attachment.url}
                  alt={attachment.original_name}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="hb-text flex h-40 items-center justify-center text-sm font-semibold">
                  PDF
                </div>
              )}
              <div className="hb-text-muted truncate px-4 py-3 text-sm">
                {attachment.original_name}
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

