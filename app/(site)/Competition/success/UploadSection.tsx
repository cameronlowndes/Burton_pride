"use client";

import DriveUploader from "./DriveUploader";

export default function UploadSection({
  sessionId,
  email,
}: {
  sessionId: string;
  email: string;
}) {
  return (
    <DriveUploader
      sessionId={sessionId}
      email={email}
      onUploaded={(url) => {
        console.log("Image uploaded:", url);
      }}
    />
  );
}
