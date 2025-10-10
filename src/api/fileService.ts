import axios from '../api/_axiosInstance'

export const uploadFile = async (
  file: File,
  employeeId: number,
  documentType: string
): Promise<number> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('employeeId', employeeId.toString())
  formData.append('documentType', documentType)

  const response = await axios.post<{ fileId: number }>('Files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data.fileId
}

export const getFileUrl = (id: number): string => {
  return `https://localhost:7245/api/Files/${id}`
}
