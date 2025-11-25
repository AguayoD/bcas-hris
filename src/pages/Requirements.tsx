import React, { useState, useEffect } from "react";
import { Button, message, Modal } from "antd";
import { useAuth } from "../types/useAuth";
import { ROLES } from "../types/auth";

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
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { user } = useAuth();
  
  // Check permissions - only the employee themselves can upload
  const isAdmin = user?.roleId === ROLES.Admin;
  const isHR = user?.roleId === ROLES.HR;
  const isCurrentEmployee = user?.employeeId === employeeId;
  
  // Admin and HR can only view, only current employee can upload
  const canUploadRequirements = isCurrentEmployee;
  const canViewRequirements = isAdmin || isHR || isCurrentEmployee;

  // Fetch existing uploaded files for the employee on load or employeeId change
  useEffect(() => {
    if (!employeeId || !canViewRequirements) {
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
  }, [employeeId, canViewRequirements]);

  const onFileChange = (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUploadRequirements) {
      message.warning("You don't have permission to upload requirements");
      return;
    }
    
    setFilesMap((prev) => ({
      ...prev,
      [docId]: e.target.files,
    }));
  };

  // Helper function to get file names from FileList
  const getFileNames = (files: FileList | null): string[] => {
    if (!files) return [];
    const names: string[] = [];
    for (let i = 0; i < files.length; i++) {
      names.push(files[i].name);
    }
    return names;
  };

  // Show confirmation modal
  const showConfirmationModal = () => {
    // Check if any files are selected
    const hasFilesSelected = Object.values(filesMap).some(files => files && files.length > 0);
    
    if (!hasFilesSelected) {
      message.info("No files selected to upload.");
      return;
    }

    setIsModalVisible(true);
  };

  // Handle modal confirmation
  const handleConfirmSubmit = async () => {
    setIsModalVisible(false);
    await performUpload();
  };

  // Handle modal cancellation
  const handleCancelSubmit = () => {
    setIsModalVisible(false);
  };

  // Actual upload logic
  const performUpload = async () => {
    if (!employeeId) {
      message.error("Employee ID is missing");
      return;
    }

    if (!canUploadRequirements) {
      message.warning("You don't have permission to upload requirements");
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

  // Download file handler - allow everyone with view permissions to download
  const handleDownload = (fileId: number, fileName: string) => {
    if (!canViewRequirements) {
      message.warning("You don't have permission to download files");
      return;
    }

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

  // If no permissions to view at all
  if (!canViewRequirements) {
    return (
      <div className="requirements-container">
        <div style={{ 
          textAlign: 'center', 
          padding: '20px', 
          backgroundColor: '#f5f5f5', 
          borderRadius: '4px',
          marginBottom: '16px'
        }}>
          <p style={{ color: '#999', margin: 0 }}>
            You don't have permission to view requirements for this employee.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="requirements-container">
      {/* Confirmation Modal */}
      <Modal
        title="Confirm Submission"
        open={isModalVisible}
        onOk={handleConfirmSubmit}
        onCancel={handleCancelSubmit}
        okText="Yes, Submit Requirements"
        cancelText="Cancel"
      >
        <p>Are you sure you want to submit these requirements?</p>
        <p style={{ color: '#666', fontSize: '14px' }}>
          This will upload all selected files. You can upload additional files later if needed.
        </p>
      </Modal>
      
      {!canUploadRequirements && (
        <div style={{ 
          textAlign: 'center', 
          padding: '20px', 
          backgroundColor: '#f5f5f5', 
          borderRadius: '4px',
          marginBottom: '16px'
        }}>
          <p style={{ color: '#999', margin: 0 }}>
            View mode: You can only view and download requirements. Only the employee themselves can upload requirements.
          </p>
        </div>
      )}
      
      <div className="requirement-section">
        {DOCUMENTS.map((doc) => {
          const uploadedFile = uploadedFiles[doc.label];
          const selectedFiles = filesMap[doc.id];
          const selectedFileNames = getFileNames(selectedFiles);

          return (
            <div className="requirement-item" key={doc.id} style={{ marginBottom: 16 }}>
              <div className="requirement-label" style={{ marginBottom: 4, fontWeight: 'bold' }}>
                {doc.label}:
              </div>
              <div
                className="requirement-control"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                {canUploadRequirements ? (
                  <>
                    <input
                      type="file"
                      id={doc.id}
                      style={{ display: "none" }}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      multiple={doc.multiple || false}
                      onChange={(e) => onFileChange(doc.id, e)}
                    />
                    <Button 
                      type="default" 
                      onClick={() => document.getElementById(doc.id)?.click()}
                    >
                      Select File{doc.multiple ? "(s)" : ""}
                    </Button>
                    <div>
                      {selectedFiles && selectedFiles.length > 0
                        ? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected`
                        : uploadedFile
                        ? "File already uploaded"
                        : "No file selected"}
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#666', fontStyle: 'italic' }}>
                    {uploadedFile ? "File uploaded" : "No file uploaded yet"}
                  </div>
                )}

                {uploadedFile && (
                  <Button
                    type="link"
                    onClick={() => handleDownload(uploadedFile.id, uploadedFile.fileName)}
                    style={{ marginLeft: 12 }}
                  >
                    Download
                  </Button>
                )}
              </div>
              
              {/* Show selected file names */}
              {selectedFileNames.length > 0 && (
                <div style={{ fontSize: '12px', color: '#1890ff', marginTop: '4px' }}>
                  Selected: {selectedFileNames.join(', ')}
                </div>
              )}
              
              {/* Show uploaded file name */}
              {uploadedFile && !selectedFileNames.length && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Current file: {uploadedFile.fileName}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canUploadRequirements && (
        <div className="requirements-actions" style={{ marginTop: 24 }}>
          <Button type="primary" onClick={showConfirmationModal}>
            Submit Requirements
          </Button>
        </div>
      )}
    </div>
  );
};

export default Requirements;