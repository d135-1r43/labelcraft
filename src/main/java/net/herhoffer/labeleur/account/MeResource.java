package net.herhoffer.labeleur.account;

import java.util.Optional;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@Path("/me")
@Tag(name = "Account")
public class MeResource
{
	/**
	 * The signed-in user, and where they manage their account and sign out.
	 * {@code accountUrl} is Keycloak's account console.
	 */
	public record Me(String id, String name, String email, String accountUrl, String logoutUrl)
	{
	}

	private final CurrentUser user;
	private final Optional<String> authServer;

	MeResource(CurrentUser user, @ConfigProperty(name = "quarkus.oidc.auth-server-url") Optional<String> authServer)
	{
		this.user = user;
		this.authServer = authServer;
	}

	@GET
	@Operation(summary = "The signed-in user; sets up their sample data on first call")
	public Me me()
	{
		String id = user.id();
		String email = user.email().orElse(null);
		return new Me(id, user.name().orElse(email), email, authServer.map(u -> u.replaceAll("/+$", "") + "/account").orElse(null), "/logout");
	}
}
