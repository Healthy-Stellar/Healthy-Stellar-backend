# Bugfix Requirements Document: EHR Import Temp File Cleanup

## Introduction

EhrImportService.enqueue() writes uploaded HL7/CCD/CSV buffers unencrypted to the local temp directory via TempStorageService.writeBuffer(). EhrImportProcessor.process() only deletes the temp file at the end of the success path (line 182). When reading, parsing, or any processing step fails, the job is marked FAILED but the temp file remains on disk with full unencrypted patient records. Malformed uploads, which are a common failure case, cause sensitive data to accumulate on the container filesystem unencrypted and undeleted.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the processor reads the temp file and throws an error THEN the system marks the job FAILED but leaves the temp file on disk unencrypted and undeleted

1.2 WHEN the parser fails to parse the buffer (HL7/CCD/CSV parsing error) THEN the system marks the job FAILED but leaves the temp file on disk unencrypted and undeleted

1.3 WHEN any downstream error occurs during IPFS upload, Stellar anchoring, or database operations THEN the system marks the job FAILED but leaves the temp file on disk unencrypted and undeleted

### Expected Behavior (Correct)

2.1 WHEN the processor reads the temp file and throws an error THEN the system SHALL mark the job FAILED and delete the temp file before returning

2.2 WHEN the parser fails to parse the buffer THEN the system SHALL mark the job FAILED and delete the temp file before returning

2.3 WHEN any downstream error occurs during IPFS upload, Stellar anchoring, or database operations THEN the system SHALL mark the job FAILED and delete the temp file before returning

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the processor completes successfully and all records are processed THEN the system SHALL CONTINUE TO delete the temp file at the end of the success path

3.2 WHEN the processor encounters a parsing error but the temp file exists THEN the system SHALL delete only the identified temp file without affecting other files in the temp directory

3.3 WHEN multiple concurrent jobs are processing different temp files THEN the system SHALL delete only the specific temp file associated with each job without interfering with other jobs
