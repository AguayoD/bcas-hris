import axios from 'axios'
// import Toastify from '../components/Toastify'

const axiosInstance = axios.create({
    baseURL: "https://localhost:7245/api/",
    headers: { 'X-Custom-Header': 'foobar' },
})

axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken')

        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`
        }

        return config
    },
    (error) => {
        // const { message } = error
        // Toastify.Error(message)
        return Promise.reject(error)
    },
)
export default axiosInstance
