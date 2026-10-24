package net.herhoffer.labelcraft.account;

import java.util.Optional;

import io.quarkus.security.UnauthorizedException;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.RequestScoped;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * The signed-in user. Their OIDC subject owns every record they create; the
 * first time it is asked for, their sample data is set up.
 */
@RequestScoped
public class CurrentUser
{
	private final SecurityIdentity identity;
	private final Provisioner provisioner;
	private boolean provisioned;

	CurrentUser(SecurityIdentity identity, Provisioner provisioner)
	{
		this.identity = identity;
		this.provisioner = provisioner;
	}

	/** The OIDC subject, stable across email and name changes. */
	public String id()
	{
		if (identity.isAnonymous()) throw new UnauthorizedException();
		String id = identity.getPrincipal().getName();
		if (!provisioned)
		{
			provisioner.ensure(id);
			provisioned = true;
		}
		return id;
	}

	public Optional<String> name()
	{
		return claim("name").or(() -> claim("given_name"));
	}

	public Optional<String> email()
	{
		return claim("email");
	}

	private Optional<String> claim(String name)
	{
		if (identity.getPrincipal() instanceof JsonWebToken jwt) return Optional.ofNullable(jwt.<String> getClaim(name)).filter(s -> !s.isBlank());
		return Optional.empty();
	}
}
