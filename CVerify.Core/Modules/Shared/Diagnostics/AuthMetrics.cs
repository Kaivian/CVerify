using System.Diagnostics.Metrics;

namespace CVerify.API.Modules.Shared.Diagnostics;

public class AuthMetrics
{
    private readonly Counter<long> _registrationsCounter;
    private readonly Counter<long> _verificationsCounter;
    private readonly Counter<long> _passwordResetsCounter;
    private readonly Counter<long> _loginSuccessCounter;
    private readonly Counter<long> _loginFailedCounter;

    public AuthMetrics()
    {
        var meter = new Meter("CVerify.Auth", "1.0.0");
        _registrationsCounter = meter.CreateCounter<long>("auth.registrations.completed", "count", "Number of completed user registrations");
        _verificationsCounter = meter.CreateCounter<long>("auth.verifications.completed", "count", "Number of completed email verifications");
        _passwordResetsCounter = meter.CreateCounter<long>("auth.password_resets.completed", "count", "Number of completed password resets");
        _loginSuccessCounter = meter.CreateCounter<long>("auth.login.success", "count", "Number of successful logins");
        _loginFailedCounter = meter.CreateCounter<long>("auth.login.failed", "count", "Number of failed login attempts");
    }

    public void RecordRegistration() => _registrationsCounter.Add(1);
    public void RecordVerification() => _verificationsCounter.Add(1);
    public void RecordPasswordReset() => _passwordResetsCounter.Add(1);
    public void RecordLoginSuccess() => _loginSuccessCounter.Add(1);
    public void RecordLoginFailed() => _loginFailedCounter.Add(1);
}
