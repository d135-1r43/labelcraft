package net.herhoffer.labeleur.records;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.NotFoundException;

/**
 * The collections Labeleur keeps, by the id the frontend uses for each entity.
 */
@ApplicationScoped
public class RecordCollections
{

	private final Map<String, RecordCollection<?>> byId = new LinkedHashMap<>();

	RecordCollections(ContactRepository contacts, InventoryItemRepository inventory, StorageLocationRepository locations, RecipeRepository recipes, SignRepository signs, BoxRepository boxes)
	{
		add(new RecordCollection<>("contacts", Contact.class, contacts));
		add(new RecordCollection<>("inventory", InventoryItem.class, inventory));
		add(new RecordCollection<>("locations", StorageLocation.class, locations));
		add(new RecordCollection<>("recipes", Recipe.class, recipes));
		add(new RecordCollection<>("signs", Sign.class, signs));
		add(new RecordCollection<>("boxes", Box.class, boxes));
	}

	private void add(RecordCollection<?> c)
	{
		byId.put(c.id(), c);
	}

	public RecordCollection<?> get(String id)
	{
		RecordCollection<?> c = byId.get(id);
		if (c == null) throw new NotFoundException("No collection named " + id);
		return c;
	}

	public boolean exists(String id)
	{
		return byId.containsKey(id);
	}

	public List<RecordCollection<?>> all()
	{
		return List.copyOf(byId.values());
	}
}
