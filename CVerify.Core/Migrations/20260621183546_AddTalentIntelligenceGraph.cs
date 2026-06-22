using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CVerify.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTalentIntelligenceGraph : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:user_status", "EMAIL_VERIFY_PENDING,ACTIVE,SUSPENDED,BANNED,DELETION_PENDING,DELETED")
                .Annotation("Npgsql:PostgresExtension:citext", ",,")
                .Annotation("Npgsql:PostgresExtension:pgcrypto", ",,")
                .OldAnnotation("Npgsql:Enum:user_status", "EMAIL_VERIFY_PENDING,ACTIVE,SUSPENDED,BANNED,DELETION_PENDING,DELETED")
                .OldAnnotation("Npgsql:PostgresExtension:citext", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:pgcrypto", ",,");

            migrationBuilder.CreateTable(
                name: "candidate_match_projections",
                columns: table => new
                {
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    profile_summary = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    normalized_capabilities = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    last_projected_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_match_projections", x => x.candidate_id);
                    table.ForeignKey(
                        name: "fk_candidate_match_projections_users_candidate_id",
                        column: x => x.candidate_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_search_profiles",
                columns: table => new
                {
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    full_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    headline = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    location = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    trust_score = table.Column<int>(type: "integer", nullable: false),
                    trust_tier = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    capabilities_json = table.Column<string>(type: "jsonb", nullable: false),
                    search_embedding = table.Column<float[]>(type: "real[]", nullable: false),
                    last_projected_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_search_profiles", x => x.candidate_id);
                    table.ForeignKey(
                        name: "fk_candidate_search_profiles_users_candidate_id",
                        column: x => x.candidate_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "capability_nodes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    slug = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    vector_embedding = table.Column<float[]>(type: "real[]", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_capability_nodes", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "evidence_sources",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    provider_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    connection_config = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_evidence_sources", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "matching_evaluations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    job_vacancy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    aggregate_score = table.Column<int>(type: "integer", nullable: false),
                    confidence_level = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_matching_evaluations", x => x.id);
                    table.ForeignKey(
                        name: "fk_matching_evaluations_job_vacancies_job_vacancy_id",
                        column: x => x.job_vacancy_id,
                        principalTable: "job_vacancies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_matching_evaluations_users_candidate_id",
                        column: x => x.candidate_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "trust_profiles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    recalculated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_trust_profiles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "candidate_capabilities",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    capability_node_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_capabilities", x => x.id);
                    table.ForeignKey(
                        name: "fk_candidate_capabilities_capability_nodes_capability_node_id",
                        column: x => x.capability_node_id,
                        principalTable: "capability_nodes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_candidate_capabilities_users_candidate_id",
                        column: x => x.candidate_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "capability_edges",
                columns: table => new
                {
                    source_node_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_node_id = table.Column<Guid>(type: "uuid", nullable: false),
                    relationship_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    weight = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_capability_edges", x => new { x.source_node_id, x.target_node_id, x.relationship_type });
                    table.ForeignKey(
                        name: "fk_capability_edges_capability_nodes_source_node_id",
                        column: x => x.source_node_id,
                        principalTable: "capability_nodes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_capability_edges_capability_nodes_target_node_id",
                        column: x => x.target_node_id,
                        principalTable: "capability_nodes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "evidence_artifacts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    external_identifier = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    artifact_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    payload = table.Column<string>(type: "jsonb", nullable: false),
                    cryptographic_signature = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_evidence_artifacts", x => x.id);
                    table.ForeignKey(
                        name: "fk_evidence_artifacts_evidence_sources_source_id",
                        column: x => x.source_id,
                        principalTable: "evidence_sources",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "matching_factors",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    matching_evaluation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    factor_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    factor_score = table.Column<int>(type: "integer", nullable: false),
                    weight = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_matching_factors", x => x.id);
                    table.ForeignKey(
                        name: "fk_matching_factors_matching_evaluations_matching_evaluation_id",
                        column: x => x.matching_evaluation_id,
                        principalTable: "matching_evaluations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_trust_projections",
                columns: table => new
                {
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    trust_profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    aggregate_score = table.Column<int>(type: "integer", nullable: false),
                    trust_tier = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    last_updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_trust_projections", x => x.candidate_id);
                    table.ForeignKey(
                        name: "fk_candidate_trust_projections_trust_profiles_trust_profile_id",
                        column: x => x.trust_profile_id,
                        principalTable: "trust_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_candidate_trust_projections_users_candidate_id",
                        column: x => x.candidate_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "trust_calculations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    trust_profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    aggregate_score = table.Column<int>(type: "integer", nullable: false),
                    calculation_details = table.Column<string>(type: "jsonb", nullable: false),
                    calculated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_trust_calculations", x => x.id);
                    table.ForeignKey(
                        name: "fk_trust_calculations_trust_profiles_trust_profile_id",
                        column: x => x.trust_profile_id,
                        principalTable: "trust_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "trust_components",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    trust_profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    component_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    component_score = table.Column<int>(type: "integer", nullable: false),
                    weight = table.Column<double>(type: "double precision", nullable: false),
                    explanation_metadata = table.Column<string>(type: "jsonb", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_trust_components", x => x.id);
                    table.ForeignKey(
                        name: "fk_trust_components_trust_profiles_trust_profile_id",
                        column: x => x.trust_profile_id,
                        principalTable: "trust_profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_capability_histories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_capability_id = table.Column<Guid>(type: "uuid", nullable: false),
                    proficiency_score = table.Column<double>(type: "double precision", nullable: false),
                    recorded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_capability_histories", x => x.id);
                    table.ForeignKey(
                        name: "fk_candidate_capability_histories_candidate_capabilities_candi",
                        column: x => x.candidate_capability_id,
                        principalTable: "candidate_capabilities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_capability_scores",
                columns: table => new
                {
                    candidate_capability_id = table.Column<Guid>(type: "uuid", nullable: false),
                    expertise_level = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    proficiency_score = table.Column<double>(type: "double precision", nullable: false),
                    recency_index = table.Column<double>(type: "double precision", nullable: false),
                    calculated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_capability_scores", x => x.candidate_capability_id);
                    table.ForeignKey(
                        name: "fk_candidate_capability_scores_candidate_capabilities_candidat",
                        column: x => x.candidate_capability_id,
                        principalTable: "candidate_capabilities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_capability_evidences",
                columns: table => new
                {
                    candidate_capability_id = table.Column<Guid>(type: "uuid", nullable: false),
                    evidence_artifact_id = table.Column<Guid>(type: "uuid", nullable: false),
                    added_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_candidate_capability_evidences", x => new { x.candidate_capability_id, x.evidence_artifact_id });
                    table.ForeignKey(
                        name: "fk_candidate_capability_evidences_candidate_capabilities_candi",
                        column: x => x.candidate_capability_id,
                        principalTable: "candidate_capabilities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_candidate_capability_evidences_evidence_artifacts_evidence_",
                        column: x => x.evidence_artifact_id,
                        principalTable: "evidence_artifacts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "evidence_claims",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    evidence_artifact_id = table.Column<Guid>(type: "uuid", nullable: false),
                    assertion_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    confidence_score = table.Column<double>(type: "double precision", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_evidence_claims", x => x.id);
                    table.ForeignKey(
                        name: "fk_evidence_claims_evidence_artifacts_evidence_artifact_id",
                        column: x => x.evidence_artifact_id,
                        principalTable: "evidence_artifacts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_evidence_claims_users_candidate_id",
                        column: x => x.candidate_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "matching_explanations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    matching_evaluation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    explanation_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    capability_node_id = table.Column<Guid>(type: "uuid", nullable: true),
                    assertion_text = table.Column<string>(type: "text", nullable: false),
                    supporting_artifact_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_matching_explanations", x => x.id);
                    table.ForeignKey(
                        name: "fk_matching_explanations_capability_nodes_capability_node_id",
                        column: x => x.capability_node_id,
                        principalTable: "capability_nodes",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_matching_explanations_evidence_artifacts_supporting_artifac",
                        column: x => x.supporting_artifact_id,
                        principalTable: "evidence_artifacts",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_matching_explanations_matching_evaluations_matching_evaluat",
                        column: x => x.matching_evaluation_id,
                        principalTable: "matching_evaluations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "evidence_verifications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    evidence_claim_id = table.Column<Guid>(type: "uuid", nullable: false),
                    verification_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    verification_log = table.Column<string>(type: "jsonb", nullable: true),
                    verified_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_evidence_verifications", x => x.id);
                    table.ForeignKey(
                        name: "fk_evidence_verifications_evidence_claims_evidence_claim_id",
                        column: x => x.evidence_claim_id,
                        principalTable: "evidence_claims",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_candidate_capabilities_candidate_id_capability_node_id",
                table: "candidate_capabilities",
                columns: new[] { "candidate_id", "capability_node_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_candidate_capabilities_capability_node_id",
                table: "candidate_capabilities",
                column: "capability_node_id");

            migrationBuilder.CreateIndex(
                name: "ix_candidate_capability_evidences_evidence_artifact_id",
                table: "candidate_capability_evidences",
                column: "evidence_artifact_id");

            migrationBuilder.CreateIndex(
                name: "ix_candidate_capability_histories_candidate_capability_id_reco",
                table: "candidate_capability_histories",
                columns: new[] { "candidate_capability_id", "recorded_at" });

            migrationBuilder.CreateIndex(
                name: "ix_candidate_trust_projections_trust_profile_id",
                table: "candidate_trust_projections",
                column: "trust_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_capability_edges_target_node_id",
                table: "capability_edges",
                column: "target_node_id");

            migrationBuilder.CreateIndex(
                name: "ix_capability_nodes_slug",
                table: "capability_nodes",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_evidence_artifacts_source_id_external_identifier",
                table: "evidence_artifacts",
                columns: new[] { "source_id", "external_identifier" });

            migrationBuilder.CreateIndex(
                name: "ix_evidence_claims_candidate_id_evidence_artifact_id",
                table: "evidence_claims",
                columns: new[] { "candidate_id", "evidence_artifact_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_evidence_claims_evidence_artifact_id",
                table: "evidence_claims",
                column: "evidence_artifact_id");

            migrationBuilder.CreateIndex(
                name: "ix_evidence_verifications_evidence_claim_id",
                table: "evidence_verifications",
                column: "evidence_claim_id");

            migrationBuilder.CreateIndex(
                name: "ix_matching_evaluations_candidate_id",
                table: "matching_evaluations",
                column: "candidate_id");

            migrationBuilder.CreateIndex(
                name: "ix_matching_evaluations_job_vacancy_id_candidate_id",
                table: "matching_evaluations",
                columns: new[] { "job_vacancy_id", "candidate_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_matching_explanations_capability_node_id",
                table: "matching_explanations",
                column: "capability_node_id");

            migrationBuilder.CreateIndex(
                name: "ix_matching_explanations_matching_evaluation_id",
                table: "matching_explanations",
                column: "matching_evaluation_id");

            migrationBuilder.CreateIndex(
                name: "ix_matching_explanations_supporting_artifact_id",
                table: "matching_explanations",
                column: "supporting_artifact_id");

            migrationBuilder.CreateIndex(
                name: "ix_matching_factors_matching_evaluation_id",
                table: "matching_factors",
                column: "matching_evaluation_id");

            migrationBuilder.CreateIndex(
                name: "ix_trust_calculations_trust_profile_id",
                table: "trust_calculations",
                column: "trust_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_trust_components_trust_profile_id",
                table: "trust_components",
                column: "trust_profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_trust_profiles_target_entity_id_target_type",
                table: "trust_profiles",
                columns: new[] { "target_entity_id", "target_type" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "candidate_capability_evidences");

            migrationBuilder.DropTable(
                name: "candidate_capability_histories");

            migrationBuilder.DropTable(
                name: "candidate_capability_scores");

            migrationBuilder.DropTable(
                name: "candidate_match_projections");

            migrationBuilder.DropTable(
                name: "candidate_search_profiles");

            migrationBuilder.DropTable(
                name: "candidate_trust_projections");

            migrationBuilder.DropTable(
                name: "capability_edges");

            migrationBuilder.DropTable(
                name: "evidence_verifications");

            migrationBuilder.DropTable(
                name: "matching_explanations");

            migrationBuilder.DropTable(
                name: "matching_factors");

            migrationBuilder.DropTable(
                name: "trust_calculations");

            migrationBuilder.DropTable(
                name: "trust_components");

            migrationBuilder.DropTable(
                name: "candidate_capabilities");

            migrationBuilder.DropTable(
                name: "evidence_claims");

            migrationBuilder.DropTable(
                name: "matching_evaluations");

            migrationBuilder.DropTable(
                name: "trust_profiles");

            migrationBuilder.DropTable(
                name: "capability_nodes");

            migrationBuilder.DropTable(
                name: "evidence_artifacts");

            migrationBuilder.DropTable(
                name: "evidence_sources");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:user_status", "EMAIL_VERIFY_PENDING,ACTIVE,SUSPENDED,BANNED,DELETION_PENDING,DELETED")
                .Annotation("Npgsql:PostgresExtension:citext", ",,")
                .Annotation("Npgsql:PostgresExtension:pgcrypto", ",,")
                .OldAnnotation("Npgsql:Enum:user_status", "EMAIL_VERIFY_PENDING,ACTIVE,SUSPENDED,BANNED,DELETION_PENDING,DELETED")
                .OldAnnotation("Npgsql:PostgresExtension:citext", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:pgcrypto", ",,");
        }
    }
}
