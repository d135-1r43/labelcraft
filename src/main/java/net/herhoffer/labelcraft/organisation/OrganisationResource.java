package net.herhoffer.labelcraft.organisation;

import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import net.herhoffer.labelcraft.account.CurrentUser;
import net.herhoffer.labelcraft.account.Profile;
import net.herhoffer.labelcraft.account.ProfileRepository;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Who the signed-in user prints as: the return address on address labels and
 * the owner line on asset tags. Starts as the sample organisation.
 */
@Path("/organisation")
@Tag(name = "Organisation")
public class OrganisationResource
{
	public record AddressView(@Size(max = 300) String company, @Size(max = 300) String street, @Size(max = 40) String houseNumber, @Size(max = 40) String postalCode, @Size(max = 200) String city, @Size(max = 100) String region, @NotNull @Pattern(regexp = "[A-Z]{2}") String country)
	{
	}

	public record OrganisationView(@NotNull @Size(max = 300) String name, @NotNull @Valid AddressView address)
	{
		static OrganisationView of(Profile p)
		{
			return new OrganisationView(p.name, new AddressView(p.company, p.street, p.houseNumber, p.postalCode, p.city, p.region, p.country));
		}
	}

	private final ProfileRepository profiles;
	private final CurrentUser user;

	OrganisationResource(ProfileRepository profiles, CurrentUser user)
	{
		this.profiles = profiles;
		this.user = user;
	}

	@GET
	@Operation(summary = "The sender: name and return address")
	public OrganisationView get()
	{
		return OrganisationView.of(profiles.findById(user.id()));
	}

	@PUT
	@Transactional
	@Operation(summary = "Change the sender")
	public OrganisationView put(@Valid @NotNull OrganisationView view)
	{
		Profile p = profiles.findById(user.id());
		p.name = view.name().strip();
		var a = view.address();
		p.company = blankToNull(a.company());
		p.street = blankToNull(a.street());
		p.houseNumber = blankToNull(a.houseNumber());
		p.postalCode = blankToNull(a.postalCode());
		p.city = blankToNull(a.city());
		p.region = blankToNull(a.region());
		p.country = a.country();
		return OrganisationView.of(p);
	}

	private static String blankToNull(String s)
	{
		return s == null || s.isBlank() ? null : s.strip();
	}
}
