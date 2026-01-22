
# 🏥 Patient Management & Medical Records Module (Backend)

## Overview
The implementation focuses on:

* Accurate patient identification
* Secure medical record handling
* Role-based privacy controls
* Prevention of duplicate patient records
* Safe handling of patient identification photos

---

## 🧱 Technologies Used

| Technology                         | Purpose                              |
| ---------------------------------- | ------------------------------------ |
| **NestJS**                         | Modular, scalable backend framework  |
| **TypeORM**                        | ORM for database modeling & queries  |
| **MySQL / MariaDB**                | Relational database for patient data |
| **Multer (Nest Platform Express)** | Secure file upload handling          |
| **JWT-based Guards**               | Authentication & authorization       |
| **Custom Guards**                  | Privacy & role enforcement           |
| **DTOs + Validation**              | Data consistency and safety          |

---

## 📁 Module Structure

```
patients/
├── dto/
│   ├── create-patient.dto.ts
├── entities/
│   └── patient.entity.ts
├── guards/
│   ├── patient-privacy.guard.ts
│   ├── admin-guard.ts
├── patients.controller.ts
├── patients.service.ts
├── patients.module.ts
```

---

## ✅ Features Implemented (Mapped to Requirements)

### 1️⃣ Patient Entity with Complete Medical Demographics

A comprehensive `Patient` entity was designed to cover **real medical demographics**, including:

* Core identifiers (UUID, MRN)
* Personal demographics (name, DOB, sex, gender identity)
* Medical demographics (blood group, allergies, ethnicity, nationality)
* Contact information
* Identification details
* Administrative workflow status

This ensures the system supports **clinical accuracy** and **regulatory expectations**.

---

### 2️⃣ Secure Medical Record Number (MRN) Generation

* MRNs are generated server-side during patient registration
* Enforced as **unique and indexed** at the database level
* Prevents collisions and ensures reliable patient identification across the system

---

### 3️⃣ Patient Registration & Admission Workflow

#### Patient Registration

* Accepts validated demographic data
* Automatically assigns an MRN
* Performs duplicate detection before insertion

```ts
@Post()
async createPatient(@Body() dto: CreatePatientDto)
```

#### Patient Admission

* Admission is an **explicit administrative action**
* Only users with admin privileges can admit a patient

```ts
@Post(':id/admit')
@UseGuards(AdminGuard)
```

---

### 4️⃣ Privacy-Controlled Patient Access & Search

#### Patient Privacy Enforcement

Access to patient data is protected using **custom guards**:

* **PatientPrivacyGuard**

  * Allows access only to:

    * The patient themselves
    * Authorized admins
* Prevents unauthorized patient lookups

```ts
@Get(':id')
@UseGuards(PatientPrivacyGuard)
```

#### Search with Privacy Controls

* Search endpoint restricted to admins only
* Supports controlled string-based search
* Result size is intentionally limited to prevent data scraping

```ts
@Get()
@UseGuards(AdminGuard)
search(@Query('query') q: string)
```
# 🏥 Patient Management & Medical Records Module (Backend)

## Overview

This pull request introduces a **comprehensive Patient Management and Medical Record system** built with **NestJS, TypeORM, and MySQL/MariaDB**, designed to meet real-world healthcare requirements around **data integrity, privacy, and safety**.

The implementation focuses on:

* Accurate patient identification
* Secure medical record handling
* Role-based privacy controls
* Prevention of duplicate patient records
* Safe handling of patient identification photos

---

## 🧱 Technologies Used

| Technology                         | Purpose                              |
| ---------------------------------- | ------------------------------------ |
| **NestJS**                         | Modular, scalable backend framework  |
| **TypeORM**                        | ORM for database modeling & queries  |
| **MySQL / MariaDB**                | Relational database for patient data |
| **Multer (Nest Platform Express)** | Secure file upload handling          |
| **JWT-based Guards**               | Authentication & authorization       |
| **Custom Guards**                  | Privacy & role enforcement           |
| **DTOs + Validation**              | Data consistency and safety          |

---

## 📁 Module Structure

```
patients/
├── dto/
│   ├── create-patient.dto.ts
├── entities/
│   └── patient.entity.ts
├── guards/
│   ├── patient-privacy.guard.ts
│   ├── admin-guard.ts
├── patients.controller.ts
├── patients.service.ts
├── patients.module.ts
```

---

## ✅ Features Implemented (Mapped to Requirements)

### 1️⃣ Patient Entity with Complete Medical Demographics

A comprehensive `Patient` entity was designed to cover **real medical demographics**, including:

* Core identifiers (UUID, MRN)
* Personal demographics (name, DOB, sex, gender identity)
* Medical demographics (blood group, allergies, ethnicity, nationality)
* Contact information
* Identification details
* Administrative workflow status

This ensures the system supports **clinical accuracy** and **regulatory expectations**.

---

### 2️⃣ Secure Medical Record Number (MRN) Generation

* MRNs are generated server-side during patient registration
* Enforced as **unique and indexed** at the database level
* Prevents collisions and ensures reliable patient identification across the system

---

### 3️⃣ Patient Registration & Admission Workflow

#### Patient Registration

* Accepts validated demographic data
* Automatically assigns an MRN
* Performs duplicate detection before insertion

```ts
@Post()
async createPatient(@Body() dto: CreatePatientDto)
```

#### Patient Admission

* Admission is an **explicit administrative action**
* Only users with admin privileges can admit a patient

```ts
@Post(':id/admit')
@UseGuards(AdminGuard)
```

---

### 4️⃣ Privacy-Controlled Patient Access & Search

#### Patient Privacy Enforcement

Access to patient data is protected using **custom guards**:

* **PatientPrivacyGuard**

  * Allows access only to:

    * The patient themselves
    * Authorized admins
* Prevents unauthorized patient lookups

```ts
@Get(':id')
@UseGuards(PatientPrivacyGuard)
```

#### Search with Privacy Controls

* Search endpoint restricted to admins only
* Supports controlled string-based search
* Result size is intentionally limited to prevent data scraping

```ts
@Get()
@UseGuards(AdminGuard)
search(@Query('query') q: string)
```

---

### 5️⃣ Patient Photo & Identification Management

#### Secure Photo Upload

* Implemented using **Multer**
* Accepts **binary file uploads**
* Enforces:

  * JPG / PNG only
  * Max size: **5MB**
* Files are stored locally with a deterministic naming scheme

```ts
@Post(':id/photo')
@UseGuards(PatientPrivacyGuard)
@UseInterceptors(FileInterceptor(...))
```

#### Storage Strategy

* Photos stored at:

  ```
  /uploads/patients/photos/
  ```
* Database stores only the **relative file path**
* Static assets served via Express integration

---

### 6️⃣ Duplicate Patient Detection

To prevent medical errors:

* Duplicate checks are performed during patient creation
* Matches are detected using:

  * National ID
  * Email
  * Phone number

If a potential duplicate is found, the operation is rejected with a conflict error.

---

## 🔐 Security & Privacy Design

* **Role-based access control**
* **Patient-level data isolation**
* **Admin-only sensitive operations**
* **Limited search exposure**
* **No public exposure of binary files**
* Designed with **healthcare data safety principles** in mind

---

## 📌 Controller Summary

The `PatientsController` provides the following endpoints:

| Endpoint                   | Description          | Guard               |
| -------------------------- | -------------------- | ------------------- |
| `POST /patients`           | Register new patient | —                   |
| `GET /patients/:id`        | Get patient by ID    | PatientPrivacyGuard |
| `GET /patients/admin/all`  | Fetch all patients   | AdminGuard          |
| `GET /patients`            | Search patients      | AdminGuard          |
| `POST /patients/:id/admit` | Admit patient        | AdminGuard          |
| `POST /patients/:id/photo` | Upload patient photo | PatientPrivacyGuard |

---

## 🏁 Acceptance Criteria Status

| Criteria                   | Status        |
| -------------------------- | ------------- |
| Unique, secure MRNs        | ✅ Implemented |
| Comprehensive demographics | ✅ Implemented |
| Privacy-controlled access  | ✅ Implemented |
| Duplicate detection        | ✅ Implemented |
| Safe photo handling        | ✅ Implemented |

---

## 📎 Notes

* Designed to be **extensible** for future features:

  * Patient merge workflows
  * Audit logging
  * Cloud storage
  * Medical encounters & records
* Follows NestJS best practices and healthcare backend conventions

---

## ✅ Conclusion

This PR lays a **solid, production-grade foundation** for patient management in a healthcare system, emphasizing **data integrity, privacy, and patient safety**, while remaining scalable and maintainable.

---
# 🏥 Patient Management & Medical Records Module (Backend)

## Overview

This pull request introduces a **comprehensive Patient Management and Medical Record system** built with **NestJS, TypeORM, and MySQL/MariaDB**, designed to meet real-world healthcare requirements around **data integrity, privacy, and safety**.

The implementation focuses on:

* Accurate patient identification
* Secure medical record handling
* Role-based privacy controls
* Prevention of duplicate patient records
* Safe handling of patient identification photos

---

## 🧱 Technologies Used

| Technology                         | Purpose                              |
| ---------------------------------- | ------------------------------------ |
| **NestJS**                         | Modular, scalable backend framework  |
| **TypeORM**                        | ORM for database modeling & queries  |
| **MySQL / MariaDB**                | Relational database for patient data |
| **Multer (Nest Platform Express)** | Secure file upload handling          |
| **JWT-based Guards**               | Authentication & authorization       |
| **Custom Guards**                  | Privacy & role enforcement           |
| **DTOs + Validation**              | Data consistency and safety          |

---

## 📁 Module Structure

```
patients/
├── dto/
│   ├── create-patient.dto.ts
├── entities/
│   └── patient.entity.ts
├── guards/
│   ├── patient-privacy.guard.ts
│   ├── admin-guard.ts
├── patients.controller.ts
├── patients.service.ts
├── patients.module.ts
```

---

## ✅ Features Implemented (Mapped to Requirements)

### 1️⃣ Patient Entity with Complete Medical Demographics

A comprehensive `Patient` entity was designed to cover **real medical demographics**, including:

* Core identifiers (UUID, MRN)
* Personal demographics (name, DOB, sex, gender identity)
* Medical demographics (blood group, allergies, ethnicity, nationality)
* Contact information
* Identification details
* Administrative workflow status

This ensures the system supports **clinical accuracy** and **regulatory expectations**.

---

### 2️⃣ Secure Medical Record Number (MRN) Generation

* MRNs are generated server-side during patient registration
* Enforced as **unique and indexed** at the database level
* Prevents collisions and ensures reliable patient identification across the system

---

### 3️⃣ Patient Registration & Admission Workflow

#### Patient Registration

* Accepts validated demographic data
* Automatically assigns an MRN
* Performs duplicate detection before insertion

```ts
@Post()
async createPatient(@Body() dto: CreatePatientDto)
```

#### Patient Admission

* Admission is an **explicit administrative action**
* Only users with admin privileges can admit a patient

```ts
@Post(':id/admit')
@UseGuards(AdminGuard)
```

---

### 4️⃣ Privacy-Controlled Patient Access & Search

#### Patient Privacy Enforcement

Access to patient data is protected using **custom guards**:

* **PatientPrivacyGuard**

  * Allows access only to:

    * The patient themselves
    * Authorized admins
* Prevents unauthorized patient lookups

```ts
@Get(':id')
@UseGuards(PatientPrivacyGuard)
```

#### Search with Privacy Controls

* Search endpoint restricted to admins only
* Supports controlled string-based search
* Result size is intentionally limited to prevent data scraping

```ts
@Get()
@UseGuards(AdminGuard)
search(@Query('query') q: string)
```

---

### 5️⃣ Patient Photo & Identification Management

#### Secure Photo Upload

* Implemented using **Multer**
* Accepts **binary file uploads**
* Enforces:

  * JPG / PNG only
  * Max size: **5MB**
* Files are stored locally with a deterministic naming scheme

```ts
@Post(':id/photo')
@UseGuards(PatientPrivacyGuard)
@UseInterceptors(FileInterceptor(...))
```

#### Storage Strategy

* Photos stored at:

  ```
  /uploads/patients/photos/
  ```
* Database stores only the **relative file path**
* Static assets served via Express integration

---

### 6️⃣ Duplicate Patient Detection

To prevent medical errors:

* Duplicate checks are performed during patient creation
* Matches are detected using:

  * National ID
  * Email
  * Phone number

If a potential duplicate is found, the operation is rejected with a conflict error.

---

## 🔐 Security & Privacy Design

* **Role-based access control**
* **Patient-level data isolation**
* **Admin-only sensitive operations**
* **Limited search exposure**
* **No public exposure of binary files**
* Designed with **healthcare data safety principles** in mind

---

## 📌 Controller Summary

The `PatientsController` provides the following endpoints:

| Endpoint                   | Description          | Guard               |
| -------------------------- | -------------------- | ------------------- |
| `POST /patients`           | Register new patient | —                   |
| `GET /patients/:id`        | Get patient by ID    | PatientPrivacyGuard |
| `GET /patients/admin/all`  | Fetch all patients   | AdminGuard          |
| `GET /patients`            | Search patients      | AdminGuard          |
| `POST /patients/:id/admit` | Admit patient        | AdminGuard          |
| `POST /patients/:id/photo` | Upload patient photo | PatientPrivacyGuard |

---

## 🏁 Acceptance Criteria Status

| Criteria                   | Status        |
| -------------------------- | ------------- |
| Unique, secure MRNs        | ✅ Implemented |
| Comprehensive demographics | ✅ Implemented |
| Privacy-controlled access  | ✅ Implemented |
| Duplicate detection        | ✅ Implemented |
| Safe photo handling        | ✅ Implemented |

---

## 📎 Notes

* Designed to be **extensible** for future features:

  * Patient merge workflows
  * Audit logging
  * Cloud storage
  * Medical encounters & records
* Follows NestJS best practices and healthcare backend conventions

---

## ✅ Conclusion

This PR lays a **solid, production-grade foundation** for patient management in a healthcare system, emphasizing **data integrity, privacy, and patient safety**, while remaining scalable and maintainable.

---

---

### 5️⃣ Patient Photo & Identification Management

#### Secure Photo Upload

* Implemented using **Multer**
* Accepts **binary file uploads**
* Enforces:

  * JPG / PNG only
  * Max size: **5MB**
* Files are stored locally with a deterministic naming scheme

```ts
@Post(':id/photo')
@UseGuards(PatientPrivacyGuard)
@UseInterceptors(FileInterceptor(...))
```

#### Storage Strategy

* Photos stored at:

  ```
  /uploads/patients/photos/
  ```
* Database stores only the **relative file path**
* Static assets served via Express integration

---

### 6️⃣ Duplicate Patient Detection

To prevent medical errors:

* Duplicate checks are performed during patient creation
* Matches are detected using:

  * National ID
  * Email
  * Phone number

If a potential duplicate is found, the operation is rejected with a conflict error.

---

## 🔐 Security & Privacy Design

* **Role-based access control**
* **Patient-level data isolation**
* **Admin-only sensitive operations**
* **Limited search exposure**
* **No public exposure of binary files**
* Designed with **healthcare data safety principles** in mind

---

## 📌 Controller Summary

The `PatientsController` provides the following endpoints:

| Endpoint                   | Description          | Guard               |
| -------------------------- | -------------------- | ------------------- |
| `POST /patients`           | Register new patient | —                   |
| `GET /patients/:id`        | Get patient by ID    | PatientPrivacyGuard |
| `GET /patients/admin/all`  | Fetch all patients   | AdminGuard          |
| `GET /patients`            | Search patients      | AdminGuard          |
| `POST /patients/:id/admit` | Admit patient        | AdminGuard          |
| `POST /patients/:id/photo` | Upload patient photo | PatientPrivacyGuard |

---

## 🏁 Acceptance Criteria Status

| Criteria                   | Status        |
| -------------------------- | ------------- |
| Unique, secure MRNs        | ✅ Implemented |
| Comprehensive demographics | ✅ Implemented |
| Privacy-controlled access  | ✅ Implemented |
| Duplicate detection        | ✅ Implemented |
| Safe photo handling        | ✅ Implemented |

---

## 📎 Notes

* Designed to be **extensible** for future features:

  * Patient merge workflows
  * Audit logging
  * Cloud storage
  * Medical encounters & records
* Follows NestJS best practices and healthcare backend conventions

---

## ✅ Conclusion

This PR lays a **solid, production-grade foundation** for patient management in a healthcare system, emphasizing **data integrity, privacy, and patient safety**, while remaining scalable and maintainable.

---