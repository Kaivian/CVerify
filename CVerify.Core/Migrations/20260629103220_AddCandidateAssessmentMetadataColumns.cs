using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateAssessmentMetadataColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_assessments' AND column_name = 'calculation_mode') THEN
                        ALTER TABLE candidate_assessments ADD COLUMN calculation_mode VARCHAR(50);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_assessments' AND column_name = 'clone_risk_classification') THEN
                        ALTER TABLE candidate_assessments ADD COLUMN clone_risk_classification VARCHAR(50);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_assessments' AND column_name = 'evidence_completeness') THEN
                        ALTER TABLE candidate_assessments ADD COLUMN evidence_completeness VARCHAR(50);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_assessments' AND column_name = 'input_feature_set_hash') THEN
                        ALTER TABLE candidate_assessments ADD COLUMN input_feature_set_hash VARCHAR(100);
                    END IF;
                END $$;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "calculation_mode",
                table: "candidate_assessments");

            migrationBuilder.DropColumn(
                name: "clone_risk_classification",
                table: "candidate_assessments");

            migrationBuilder.DropColumn(
                name: "evidence_completeness",
                table: "candidate_assessments");

            migrationBuilder.DropColumn(
                name: "input_feature_set_hash",
                table: "candidate_assessments");
        }
    }
}
