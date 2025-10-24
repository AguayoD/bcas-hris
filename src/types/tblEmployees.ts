export interface Employee {
  employeeID?: number;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: Date | string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  positionID?: number;
  departmentID?: number | null; 
  departmentID2?: number | null;
  departmentID3?: number | null;
  roleID?: number;
  employmentStatus?: number;
  hireDate?: Date | string;

  // Family member fields
  memberFirstName?: string;
  memberLastName?: string;
  memberGender?: string;
  memberAddress?: string;
  memberPhoneNumber?: string;

  //Educational Attainment
  educationalAttainment?: number;
  institutionName?: string;
  yearGraduated?: Date | string;
  courseName?: string;

  //Work Experience
  previousPosition?: string;
  officeName ?: string;
  durationStart ?: Date | string;
  durationEnd ?: Date | string;
  agencyName ?: string;
  supervisor ?: string;
  accomplishment ?: string;
  summary ?: string;
  
}
