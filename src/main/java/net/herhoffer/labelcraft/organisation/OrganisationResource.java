package net.herhoffer.labelcraft.organisation;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@Path("/organisation")
@Tag(name = "Organisation")
public class OrganisationResource
{

	public record AddressView(String company, String street, String houseNumber, String postalCode, String city, String region, String country)
	{
	}

	public record OrganisationView(String name, AddressView address)
	{
	}

	private final Organisation org;

	OrganisationResource(Organisation org)
	{
		this.org = org;
	}

	@GET
	public OrganisationView get()
	{
		var a = org.address();
		return new OrganisationView(org.name(), new AddressView(a.company().orElse(null), a.street().orElse(null), a.houseNumber().orElse(null), a.postalCode().orElse(null), a.city().orElse(null), a.region().orElse(null), a.country()));
	}
}
