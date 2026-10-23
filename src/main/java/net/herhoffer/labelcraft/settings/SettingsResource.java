package net.herhoffer.labelcraft.settings;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import net.herhoffer.labelcraft.records.RecordCollections;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.resteasy.reactive.RestPath;

@Path("/settings/entities")
@Tag(name = "Settings")
public class SettingsResource
{

	/** One entity's preferences, as the Preferences dialog edits them. */
	public record EntityPrefs(boolean enabled, @NotNull @Size(max = 200) String name, @NotNull @Size(max = 2048) String baseUrl)
	{

		@AssertTrue(message = "must be a complete http or https address")
		public boolean isBaseUrlValid()
		{
			if (baseUrl == null || baseUrl.isEmpty()) return true;
			try
			{
				URI u = URI.create(baseUrl);
				return ("http".equals(u.getScheme()) || "https".equals(u.getScheme())) && u.getHost() != null;
			}
			catch (IllegalArgumentException e)
			{
				return false;
			}
		}

		static EntityPrefs of(EntitySettings s)
		{
			return new EntityPrefs(s.enabled, s.name, s.baseUrl);
		}
	}

	private final EntitySettingsRepository settings;
	private final RecordCollections collections;

	SettingsResource(EntitySettingsRepository settings, RecordCollections collections)
	{
		this.settings = settings;
		this.collections = collections;
	}

	@GET
	@Operation(summary = "Preferences of every entity, by collection id")
	public Map<String, EntityPrefs> all()
	{
		Map<String, EntityPrefs> out = new LinkedHashMap<>();
		for (var c : collections.all())
		{
			EntitySettings s = settings.findById(c.id());
			if (s != null) out.put(c.id(), EntityPrefs.of(s));
		}
		return out;
	}

	@PUT
	@Path("/{id}")
	@Transactional
	@Operation(summary = "Switch an entity on or off, or change its leading system")
	public EntityPrefs put(@RestPath String id, @Valid @NotNull EntityPrefs prefs)
	{
		if (!collections.exists(id)) throw new NotFoundException("No collection named " + id);
		EntitySettings s = settings.findById(id);
		if (s == null)
		{
			s = new EntitySettings();
			s.id = id;
			settings.persist(s);
		}
		s.enabled = prefs.enabled();
		s.name = prefs.name().strip();
		s.baseUrl = prefs.baseUrl().strip();
		return EntityPrefs.of(s);
	}
}
