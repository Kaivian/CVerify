# Báo Cáo Thiết Kế Ca Kiểm Thử Tích Hợp Candidate Skill Mapping & Career Calibration Pipeline

Báo cáo này thiết kế chi tiết các ca kiểm thử tích hợp (Integration Test Cases) cho hệ thống ánh xạ kỹ năng, tính toán trình độ chuyên môn, hiệu chuẩn cấp bậc nghề nghiệp (career level), và đồng bộ hóa thẻ điểm (scorecard) của **CVerify**.

## Định nghĩa 3 mốc thời gian đánh giá trạng thái kiểm thử (3 Cột Status):
1. **Lần 1 (Thiết kế - 10/07/2026)**: Trạng thái khi các ca kiểm thử vừa được phác thảo thiết kế.
2. **Lần 2 (Triển khai - 10/07/2026)**: Trạng thái sau khi hoàn thành phần lớn unit tests cho các service logic cốt lõi.
3. **Lần 3 (Hiện tại - 10/07/2026)**: Trạng thái hiện tại sau khi đã phủ toàn bộ kiểm thử tích hợp cho cả Service, Controller và các bộ lọc bảo mật.

* **Passed**: Ca kiểm thử đã có mã kiểm thử tự động (Unit Test hoặc Integration Test) trong mã nguồn và chạy thành công.
* **Failed**: Ca kiểm thử đã được triển khai mã kiểm thử tự động nhưng kết quả chạy bị lỗi.
* **Pending**: Tính năng chưa được viết mã kiểm thử tự động cụ thể (cần kiểm thử thủ công).
* **N/A**: Không áp dụng do tính năng không nằm trong phạm vi thiết kế của mã nguồn.

---

## 1. Map project-level skills to CVerify global skill taxonomy (Ánh xạ kỹ năng cấp dự án vào phân loại kỹ năng toàn cầu)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions | Lần 1 (Thiết kế) | Lần 2 (Triển khai) | Lần 3 (Hiện tại) | Ghi chú |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CAD-MAP-001** | Ánh xạ chuẩn hóa phân loại danh mục kỹ năng (Skill taxonomy mapping). | 1. Đưa dữ liệu kết quả phân tích tác vụ `SkillExtraction` chứa danh mục như `"backend"`, `"frontend"`, `"devops"`, `"ML"` vào DB.<br>2. Chạy tiến trình chiếu quan hệ `ProjectRelationalDataAsync`. | 1. Bản ghi `RepositorySkillAttribution` và `RepositoryDomain` được tạo thành công.<br>2. Danh mục `"backend"` map thành `"Backend Engineering"`.<br>3. Danh mục `"frontend"` map thành `"Frontend Engineering"`.<br>4. Danh mục `"devops"` map thành `"DevOps & Platform Engineering"`. | - Job phân tích chứa kết quả tác vụ `SkillExtraction`. | **Pending** | **Passed** | **Passed** | Unit Test: `CandidateAssessmentRelationalProjectionTests.ProjectRelationalData_Should_Map_SkillCategories_Successfully` |
| **CAD-MAP-002** | Xử lý ánh xạ khi gặp danh mục không xác định hoặc bị thiếu. | 1. Cung cấp kết quả tác vụ `SkillExtraction` chứa danh mục trống hoặc không khớp canonical (ví dụ: `"gaming"`).<br>2. Tiến hành chạy luồng chiếu quan hệ. | 1. Bản ghi attributions được tạo.<br>2. Danh mục được chuyển đổi về mặc định `"Other Engineering"`. | - Kết quả phân tích có danh mục kỹ năng lạ. | **Pending** | **Passed** | **Passed** | Unit Test: `CandidateAssessmentRelationalProjectionTests.ProjectRelationalData_Should_Fallback_To_OtherEngineering_When_Category_Unknown` |
| **CAD-MAP-003** | Tính toán trọng số đóng góp của kỹ năng (Contribution Weight) chính xác. | 1. Đọc thuộc tính `ContributionWeight` của bản ghi `RepositorySkillAttribution` mới tạo. | 1. Trọng số đóng góp được tính đúng bằng công thức: `(overallScore / 100.0) * (confidence / 100.0)`. | - Có kết quả phân tích kỹ năng và điểm overallScore. | **Pending** | **Passed** | **Passed** | Unit Test: `CandidateAssessmentRelationalProjectionTests.ProjectRelationalData_Should_Calculate_ContributionWeight_Correctly` |

---

## 2. Estimate skill proficiency scores (frequency and complexity weights) (Ước lượng điểm trình độ chuyên môn của kỹ năng)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions | Lần 1 (Thiết kế) | Lần 2 (Triển khai) | Lần 3 (Hiện tại) | Ghi chú |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CAD-PROF-001** | Ước lượng trình độ trưởng thành `"Basic"` dựa trên điểm phức tạp. | 1. Đưa dữ liệu tác vụ `FeatureExtraction` chứa feature có điểm `complexity_score <= 3.0` vào DB.<br>2. Tiến hành chạy luồng chiếu quan hệ. | 1. Bản ghi `RepositoryCapability` được tạo.<br>2. Thuộc tính `Maturity` được đặt là `"Basic"`. | - Tác vụ `FeatureExtraction` hoàn thành. | **Pending** | **Passed** | **Passed** | Unit Test: `CandidateAssessmentRelationalProjectionTests.ProjectRelationalData_Should_Map_Maturity_To_Basic_When_Complexity_Low` |
| **CAD-PROF-002** | Ước lượng trình độ trưởng thành `"Intermediate"` dựa trên điểm phức tạp. | 1. Đưa feature có `complexity_score = 5.0` vào DB.<br>2. Tiến hành chạy chiếu quan hệ. | 1. Bản ghi capability được tạo.<br>2. Thuộc tính `Maturity` đặt là `"Intermediate"`. | - Feature có điểm phức tạp từ 3.1 đến 6.0. | **Pending** | **Passed** | **Passed** | Unit Test: `CandidateAssessmentRelationalProjectionTests.ProjectRelationalData_Should_Map_Maturity_To_Intermediate_When_Complexity_Medium` |
| **CAD-PROF-003** | Ước lượng trình độ trưởng thành `"Advanced"` dựa trên điểm phức tạp. | 1. Đưa feature có `complexity_score = 7.5` vào DB.<br>2. Tiến hành chạy chiếu quan hệ. | 1. Bản ghi capability được tạo.<br>2. Thuộc tính `Maturity` đặt là `"Advanced"`. | - Feature có điểm phức tạp từ 6.1 đến 8.0. | **Pending** | **Passed** | **Passed** | Unit Test: `CandidateAssessmentRelationalProjectionTests.ProjectRelationalData_Should_Map_Maturity_To_Advanced_When_Complexity_High` |
| **CAD-PROF-004** | Ước lượng trình độ trưởng thành `"Enterprise"` dựa trên điểm phức tạp. | 1. Đưa feature có `complexity_score = 9.0` vào DB.<br>2. Chạy chiếu quan hệ. | 1. Bản ghi capability được tạo.<br>2. Thuộc tính `Maturity` đặt là `"Enterprise"`. | - Feature có điểm phức tạp > 8.0. | **Pending** | **Passed** | **Passed** | Unit Test: `CandidateAssessmentRelationalProjectionTests.ProjectRelationalData_Should_Map_Maturity_To_Enterprise_When_Complexity_Max` |
| **CAD-PROF-005** | Quy đổi tỷ lệ điểm khó (Difficulty Score) và điểm số Capability (Score). | 1. Đọc thuộc tính `DifficultyScore` và `Score` của bản ghi `RepositoryCapability` mới tạo. | 1. `DifficultyScore` được lưu bằng `complexityScore / 10.0`.<br>2. `Score` được lưu bằng `complexityScore * 10.0`. | - Có bản ghi kết quả feature. | **Pending** | **Passed** | **Passed** | Unit Test: `CandidateAssessmentRelationalProjectionTests.ProjectRelationalData_Should_Calculate_ProficiencyScores_Correctly` |

---

## 3. Calibrate candidate career levels (Junior, Mid, Senior, Lead, Architect) (Hiệu chuẩn cấp bậc nghề nghiệp của ứng viên)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions | Lần 1 (Thiết kế) | Lần 2 (Triển khai) | Lần 3 (Hiện tại) | Ghi chú |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CAD-CAL-001** | Hiệu chuẩn cấp bậc nghề nghiệp từ luồng phân tích AI. | 1. Cung cấp luồng AI kết quả trả về `careerLevel = "L3"`, `careerLevelLabel = "Senior"`.<br>2. Gọi API hoặc lưu kết quả vào `CandidateAssessment`. | 1. Cập nhật thành công `CareerLevel = "L3"` và `CareerLevelLabel = "Senior"` trong CSDL. | - AI engine phân tích xong và trả về kết quả cấu trúc hợp lệ. | **Pending** | **Passed** | **Passed** | Unit Test: `CandidateAssessmentServiceReprocessTests.ReprocessAssessmentAsync_WithValidSchemaV2_UpdatesAllDatabaseColumns` |
| **CAD-CAL-002** | Trích xuất và lưu trữ các chiều kích thước năng lực xếp hạng của ứng viên. | 1. Kiểm tra các trường chỉ số năng lực xếp hạng (`TechnicalDepth`, `TechnicalBreadth`, `LeadershipPotential`, `ExecutionStrength`, `TrustLevel`) trong DB. | 1. Lưu trữ chính xác giá trị double quy đổi từ AI (ví dụ: Depth = 80.0, Breadth = 70.0, v.v.). | - AI trả về đầy đủ các trường chỉ số. | **Pending** | **Passed** | **Passed** | Unit Test: `CandidateAssessmentServiceReprocessTests.ReprocessAssessmentAsync_WithValidSchemaV2_UpdatesAllDatabaseColumns` |

---

## 4. Handle manual overrides or validation constraints for career levels (Xử lý ghi đè thủ công hoặc ràng buộc xác thực cấp bậc)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions | Lần 1 (Thiết kế) | Lần 2 (Triển khai) | Lần 3 (Hiện tại) | Ghi chú |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CAD-OVR-001** | Kiểm tra ràng buộc phiên bản lược đồ báo cáo AI (Schema version validation). | 1. Gửi dữ liệu AI chứa schema version không được hỗ trợ (ví dụ: `"candidate-profile-v1"`). | 1. Hệ thống ném ngoại lệ `InvalidDataException`.<br>2. Chặn đứng tiến trình xử lý, không cập nhật bất kỳ cột dữ liệu nào trong DB để bảo vệ tính nhất quán dữ liệu. | - Chạy reprocess với dữ liệu phiên bản sai lệch. | **Pending** | **Passed** | **Passed** | Unit Test: `CandidateAssessmentServiceReprocessTests.ReprocessAssessmentAsync_WithWrongSchemaVersion_FailsFastWithoutDatabaseUpdates` |
| **CAD-OVR-002** | Xác thực sự hiện diện của các thuộc tính bắt buộc trong `trustScoreMetrics`. | 1. Gửi dữ liệu AI thiếu trường bắt buộc trong `trustScoreMetrics` (ví dụ: thiếu `candidateTrustScore`). | 1. Hệ thống ném ngoại lệ `InvalidDataException` báo thiếu trường bắt buộc.<br>2. Hủy bỏ cập nhật DB. | - Chạy reprocess với dữ liệu thiếu thuộc tính. | **Pending** | **Passed** | **Passed** | Unit Test: `CandidateAssessmentServiceReprocessTests.ReprocessAssessmentAsync_WithInvalidSchemaV2_FailsFastWithoutDatabaseUpdates` |

---

## 5. Update candidate capability scorecards and history (Cập nhật thẻ điểm năng lực và lịch sử đánh giá của ứng viên)

| Test Case ID | Test Case Description | Test Case Procedure | Expected Results | Pre-conditions | Lần 1 (Thiết kế) | Lần 2 (Triển khai) | Lần 3 (Hiện tại) | Ghi chú |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CAD-SC-001** | Đồng bộ hóa và cập nhật thẻ điểm năng lực giữ nguyên nội dung định tính. | 1. Chạy cập nhật reprocess với báo cáo mới chỉ chứa các điểm số cập nhật (không chứa narrative). | 1. Thẻ điểm được cập nhật điểm số mới.<br>2. Các nội dung định tính như `SummaryHeadline`, `ProfessionalBio`, `keyStrengths` từ lần phân tích trước được giữ nguyên không bị mất. | - Đã có bản ghi artifact CandidateProfile gốc trong DB. | **Pending** | **Passed** | **Passed** | Unit Test: `CandidateAssessmentServiceReprocessTests.ReprocessAssessmentAsync_WithPriorNarratives_PreservesQualitativeFields` |
| **CAD-SC-002** | Tự động tăng phiên bản và lưu trữ lịch sử đánh giá (Version history). | 1. Kích hoạt đánh giá năng lực của ứng viên qua nhiều lần liên tiếp. | 1. Mỗi lần đánh giá mới tạo ra một bản ghi `CandidateAssessment` mới.<br>2. Cột `Version` tự động tăng dần lên (`Version = maxVersion + 1`) để theo dõi lịch sử phát triển năng lực của ứng viên. | - Kích hoạt đánh giá lần thứ hai trở đi cho cùng một ứng viên. | **Pending** | **Passed** | **Passed** | Unit Test: `CandidateAssessmentServiceTests.TriggerAssessmentAsync_Should_Succeed_When_CandidateIsReady` |
