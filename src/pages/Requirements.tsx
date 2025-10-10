import React, { useState, useEffect } from "react";
import { Button, message } from "antd";

interface DocType {
  id: string;
  label: string;
  multiple?: boolean;
}

interface UploadedFile {
  id: number; // file id in backend
  fileName: string;
  documentType: string;
  contentType: string;
}

const DOCUMENTS: DocType[] = [
  { id: "psa-birth-certificate", label: "PSA Birth Certificate" },
  { id: "marriage-certificate", label: "Marriage Certificate" },
  { id: "passport-photos", label: "Passport-Sized Photographs", multiple: true },
  { id: "educational-credentials", label: "Educational and Professional Credentials", multiple: true },
  { id: "training-certificates", label: "Training Certificates", multiple: true },
  { id: "professional-licenses", label: "Professional Licenses or Certifications", multiple: true },
  { id: "sss-number", label: "Social Security System (SSS) Number" },
  { id: "philhealth-number", label: "PhilHealth Number" },
  { id: "bir-tin", label: "BIR TIN Number" },
  { id: "pag-ibig", label: "Pag-IBIG Number" },
  { id: "nbi-clearance", label: "NBI Clearance" },
];

const API_BASE_URL = "https://localhost:7245/api/Files";

interface RequirementsProps {
  employeeId: number | null;
}

const Requirements: React.FC<RequirementsProps> = ({ employeeId }) => {
  const [filesMap, setFilesMap] = useState<{ [key: string]: FileList | null }>({});
  const [uploadedFiles, setUploadedFiles] = useState<{ [docType: string]: UploadedFile }>({});

  // Fetch existing uploaded files for the employee on load or employeeId change
  useEffect(() => {
    if (!employeeId) {
      setUploadedFiles({});
      return;
    }

    const fetchUploadedFiles = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/list/${employeeId}`);
        if (!res.ok) {
          throw new Error("Failed to fetch uploaded files.");
        }
        const data: UploadedFile[] = await res.json();

        // Map by documentType for quick lookup
        const map: { [docType: string]: UploadedFile } = {};
        data.forEach((file) => {
          map[file.documentType] = file;
        });

        setUploadedFiles(map);
      } catch (error) {
        message.error((error as Error).message);
      }
    };

    fetchUploadedFiles();
  }, [employeeId]);

  const onFileChange = (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    setFilesMap((prev) => ({
      ...prev,
      [docId]: e.target.files,
    }));
  };

  // Upload files, then refetch uploaded files list
  const handleSubmit = async () => {
    if (!employeeId) {
      message.error("Employee ID is missing");
      return;
    }

    try {
      let uploadCount = 0;

      for (const doc of DOCUMENTS) {
        const files = filesMap[doc.id];
        if (!files || files.length === 0) continue;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const formData = new FormData();
          formData.append("file", file);
          formData.append("employeeId", employeeId.toString());
          formData.append("documentType", doc.label);

          const res = await fetch(`${API_BASE_URL}/upload`, {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const err = await res.text();
            throw new Error(`Upload failed for ${doc.label}: ${err}`);
          }
          uploadCount++;
        }
      }

      if (uploadCount === 0) {
        message.info("No files selected to upload.");
      } else {
        message.success(`Successfully uploaded ${uploadCount} file(s).`);
        setFilesMap({}); // reset selected files

        // Refetch uploaded files to update UI with download buttons
        if (employeeId) {
          const res = await fetch(`${API_BASE_URL}/list/${employeeId}`);
          const data: UploadedFile[] = await res.json();
          const map: { [docType: string]: UploadedFile } = {};
          data.forEach((file) => {
            map[file.documentType] = file;
          });
          setUploadedFiles(map);
        }
      }
    } catch (error: any) {
      message.error(error.message || "Upload failed.");
    }
  };

  // Download file handler
  const handleDownload = (fileId: number, fileName: string) => {
    fetch(`${API_BASE_URL}/${fileId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("File not found.");
        }
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => {
        message.error(err.message);
      });
  };

  return (
    <div className="requirements-container">
      <div className="requirement-section">
        {DOCUMENTS.map((doc) => {
          const uploadedFile = uploadedFiles[doc.label];

          return (
            <div className="requirement-item" key={doc.id} style={{ marginBottom: 16 }}>
              <div className="requirement-label" style={{ marginBottom: 4 }}>
                {doc.label}:
              </div>
              <div
                className="requirement-control"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <input
                  type="file"
                  id={doc.id}
                  style={{ display: "none" }}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  multiple={doc.multiple || false}
                  onChange={(e) => onFileChange(doc.id, e)}
                />
                <Button type="default" onClick={() => document.getElementById(doc.id)?.click()}>
                  Select File{doc.multiple ? "(s)" : ""}
                </Button>
                <div>
                  {filesMap[doc.id]
                    ? `${filesMap[doc.id]!.length} file${filesMap[doc.id]!.length > 1 ? "s" : ""} selected`
                    : "No file selected"}
                </div>

                {uploadedFile && (
                  <Button
                    type="link"
                    onClick={() => handleDownload(uploadedFile.id, uploadedFile.fileName)}
                    style={{ marginLeft: 12 }}
                  >
                    Download Existing File
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="requirements-actions" style={{ marginTop: 24 }}>
        <Button type="primary" onClick={handleSubmit}>
          Submit All Requirements
        </Button>
      </div>
    </div>
  );
};

export default Requirements;
