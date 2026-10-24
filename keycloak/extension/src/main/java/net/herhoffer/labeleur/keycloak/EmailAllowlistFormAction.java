package net.herhoffer.labeleur.keycloak;

import java.util.List;

import jakarta.ws.rs.core.MultivaluedMap;
import org.keycloak.Config;
import org.keycloak.authentication.FormAction;
import org.keycloak.authentication.FormActionFactory;
import org.keycloak.authentication.FormContext;
import org.keycloak.authentication.ValidationContext;
import org.keycloak.events.Errors;
import org.keycloak.forms.login.LoginFormsProvider;
import org.keycloak.models.AuthenticationExecutionModel.Requirement;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.utils.FormMessage;
import org.keycloak.provider.ProviderConfigProperty;

/**
 * A step in the registration form that turns away email addresses outside
 * {@code LABELEUR_REGISTRATION_ALLOWLIST}. Read on every registration, so
 * changing the variable and restarting Keycloak is enough.
 *
 * Only meaningful with email verification on: otherwise anyone could type an
 * allowed address they do not own.
 */
public class EmailAllowlistFormAction implements FormAction, FormActionFactory
{
	public static final String ID = "labeleur-email-allowlist";
	public static final String ENV = "LABELEUR_REGISTRATION_ALLOWLIST";

	/** Message key in the Labeleur login theme. */
	static final String NOT_ALLOWED = "emailNotAllowedMessage";

	@Override
	public void validate(ValidationContext context)
	{
		MultivaluedMap<String, String> form = context.getHttpRequest().getDecodedFormParameters();
		if (new EmailAllowlist(System.getenv(ENV)).allows(form.getFirst(UserModel.EMAIL)))
		{
			context.success();
			return;
		}
		context.error(Errors.INVALID_REGISTRATION);
		form.remove("password");
		form.remove("password-confirm");
		context.validationError(form, List.of(new FormMessage(UserModel.EMAIL, NOT_ALLOWED)));
	}

	@Override
	public void buildPage(FormContext context, LoginFormsProvider form)
	{
	}

	@Override
	public void success(FormContext context)
	{
	}

	@Override
	public boolean requiresUser()
	{
		return false;
	}

	@Override
	public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user)
	{
		return true;
	}

	@Override
	public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user)
	{
	}

	@Override
	public FormAction create(KeycloakSession session)
	{
		return this;
	}

	@Override
	public String getId()
	{
		return ID;
	}

	@Override
	public String getDisplayType()
	{
		return "Labeleur email allowlist";
	}

	@Override
	public String getHelpText()
	{
		return "Rejects registrations whose email is not listed in " + ENV + ". An empty or missing variable allows everyone.";
	}

	@Override
	public String getReferenceCategory()
	{
		return null;
	}

	@Override
	public boolean isConfigurable()
	{
		return false;
	}

	@Override
	public Requirement[] getRequirementChoices()
	{
		return new Requirement[] { Requirement.REQUIRED, Requirement.DISABLED };
	}

	@Override
	public boolean isUserSetupAllowed()
	{
		return false;
	}

	@Override
	public List<ProviderConfigProperty> getConfigProperties()
	{
		return List.of();
	}

	@Override
	public void init(Config.Scope config)
	{
	}

	@Override
	public void postInit(KeycloakSessionFactory factory)
	{
	}

	@Override
	public void close()
	{
	}
}
