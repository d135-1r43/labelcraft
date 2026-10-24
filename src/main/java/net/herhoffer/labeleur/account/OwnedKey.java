package net.herhoffer.labeleur.account;

import java.io.Serializable;
import java.util.Objects;

/**
 * The key of everything a user owns: their subject and the id they chose. Two
 * users can both have a contact "c1".
 */
public class OwnedKey implements Serializable
{
	public String userId;
	public String id;

	public OwnedKey()
	{
	}

	public OwnedKey(String userId, String id)
	{
		this.userId = userId;
		this.id = id;
	}

	@Override
	public boolean equals(Object o)
	{
		return o instanceof OwnedKey k && Objects.equals(userId, k.userId) && Objects.equals(id, k.id);
	}

	@Override
	public int hashCode()
	{
		return Objects.hash(userId, id);
	}
}
