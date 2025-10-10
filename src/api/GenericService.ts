import axiosInstance from "./_axiosInstance";

const GenericService = <T>(subdirectory: string) => {
  const getById = async (id: number) => {
    const { data: response } = await axiosInstance.get<T>(
      `${subdirectory}/${id}`
    );
    return response;
  };

  const add = async (data: T) => {
    const { data: response } = await axiosInstance.post<T>(
      `${subdirectory}`,
      data
    );
    return response;
  };

  const getAll = async () => {
    const { data: response } = await axiosInstance.get<T[]>(`${subdirectory}`);
    return response;
  };

  const update = async (id: number, data: T) => {
    const { data: response } = await axiosInstance.patch<T[]>(
      `${subdirectory}/${id}`,
      data
    );
    return response;
  };

  return {
    getById,
    add,
    getAll,
    update,
  };
};

export default GenericService;
