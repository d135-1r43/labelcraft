package net.herhoffer.labelcraft.organisation;

import java.time.Instant;
import java.util.Locale;
import java.util.Set;

import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import net.herhoffer.labelcraft.account.CurrentUser;
import net.herhoffer.labelcraft.account.Profile;
import net.herhoffer.labelcraft.account.ProfileRepository;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/**
 * Who the signed-in user prints as: the return address on address labels and
 * the owner line on asset tags, the owner and logo on box labels. Starts as the
 * sample organisation.
 */
@Path("/organisation")
@Tag(name = "Organisation")
public class OrganisationResource
{
	public record AddressView(@Size(max = 300) String company, @Size(max = 300) String street, @Size(max = 40) String houseNumber, @Size(max = 40) String postalCode, @Size(max = 200) String city, @Size(max = 100) String region, @NotNull @Pattern(regexp = "[A-Z]{2}") String country)
	{
	}

	/**
	 * {@code logoUpdatedAt} is read-only: set when a logo is uploaded, absent
	 * without one.
	 */
	public record OrganisationView(@NotNull @Size(max = 300) String name, @NotNull @Valid AddressView address, Instant logoUpdatedAt)
	{
		static OrganisationView of(Profile p)
		{
			return new OrganisationView(p.name, new AddressView(p.company, p.street, p.houseNumber, p.postalCode, p.city, p.region, p.country), p.logoUpdatedAt);
		}
	}

	static final int MAX_LOGO_BYTES = 2 * 1024 * 1024;
	static final Set<String> LOGO_TYPES = Set.of("image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml");

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

	@GET
	@Path("/logo")
	@Produces("image/*")
	@Operation(summary = "The logo, as uploaded")
	public Response logo()
	{
		Profile p = profiles.findById(user.id());
		if (p.logo == null) throw new NotFoundException("No logo uploaded");
		return Response.ok(p.logo, p.logoType)
			// An SVG opened on its own must not run scripts in this origin.
			.header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
			.header("X-Content-Type-Options", "nosniff")
			.header("Cache-Control", "private, no-cache")
			.build();
	}

	@PUT
	@Path("/logo")
	@Consumes("image/*")
	@Transactional
	@Operation(summary = "Upload the logo: PNG, JPEG, GIF, WebP or SVG, up to 2 MB")
	public OrganisationView putLogo(@HeaderParam("Content-Type") String type, byte[] image)
	{
		String mediaType = type == null ? "" : type.split(";")[0].strip().toLowerCase(Locale.ROOT);
		if (!LOGO_TYPES.contains(mediaType)) throw new WebApplicationException("Upload a PNG, JPEG, GIF, WebP or SVG image", Response.Status.UNSUPPORTED_MEDIA_TYPE);
		if (image == null || image.length == 0) throw new BadRequestException("The image is empty");
		if (image.length > MAX_LOGO_BYTES) throw new WebApplicationException("The logo is larger than 2 MB", Response.Status.REQUEST_ENTITY_TOO_LARGE);
		Profile p = profiles.findById(user.id());
		p.logo = image;
		p.logoType = mediaType;
		p.logoUpdatedAt = Instant.now();
		return OrganisationView.of(p);
	}

	@DELETE
	@Path("/logo")
	@Transactional
	@Operation(summary = "Remove the logo")
	public OrganisationView deleteLogo()
	{
		Profile p = profiles.findById(user.id());
		p.logo = null;
		p.logoType = null;
		p.logoUpdatedAt = null;
		return OrganisationView.of(p);
	}

	private static String blankToNull(String s)
	{
		return s == null || s.isBlank() ? null : s.strip();
	}
}
