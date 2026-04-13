using NpgsqlTypes;

namespace CVerify.API.Modules.Shared.Domain.Enums;

public enum UserStatus
{
    [PgName("EMAIL_VERIFY_PENDING")]
    EMAIL_VERIFY_PENDING,

    [PgName("ACTIVE")]
    ACTIVE,

    [PgName("SUSPENDED")]
    SUSPENDED,

    [PgName("BANNED")]
    BANNED,

    [PgName("DELETION_PENDING")]
    DELETION_PENDING,

    [PgName("DELETED")]
    DELETED
}
