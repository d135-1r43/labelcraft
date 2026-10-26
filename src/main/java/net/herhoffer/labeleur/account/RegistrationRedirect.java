package net.herhoffer.labeleur.account;

import io.quarkus.arc.Unremovable;
import io.quarkus.oidc.OidcRedirectFilter;
import io.quarkus.oidc.Redirect;
import io.quarkus.oidc.Redirect.Location;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Signed out, {@code /register} sends the visitor to Keycloak like every
 * protected path, but asks for the registration form instead of the sign-in
 * form ({@code prompt=create}).
 */
@ApplicationScoped
@Unremovable
@Redirect(Location.OIDC_AUTHORIZATION)
public class RegistrationRedirect implements OidcRedirectFilter
{
	public static final String PATH = "/register";

	@Override
	public void filter(OidcRedirectContext context)
	{
		if (PATH.equals(context.routingContext().normalizedPath())) context.additionalQueryParams().add("prompt", "create");
	}
}
