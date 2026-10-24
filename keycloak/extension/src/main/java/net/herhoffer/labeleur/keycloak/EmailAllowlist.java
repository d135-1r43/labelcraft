package net.herhoffer.labeleur.keycloak;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Who may register, from a comma- or whitespace-separated list: full
 * addresses ({@code anna@example.com}) or whole domains ({@code @example.com}).
 * An empty list lets everyone register.
 */
public final class EmailAllowlist
{
	private final Set<String> addresses;
	private final Set<String> domains;

	public EmailAllowlist(String spec)
	{
		Set<String> entries = Arrays.stream(spec == null ? new String[0] : spec.split("[,;\\s]+"))
				.map(s -> s.trim().toLowerCase(Locale.ROOT))
				.filter(s -> !s.isEmpty())
				.collect(Collectors.toSet());
		this.addresses = entries.stream().filter(e -> !e.startsWith("@")).collect(Collectors.toUnmodifiableSet());
		this.domains = entries.stream().filter(e -> e.startsWith("@")).map(e -> e.substring(1)).collect(Collectors.toUnmodifiableSet());
	}

	public boolean isOpen()
	{
		return addresses.isEmpty() && domains.isEmpty();
	}

	public boolean allows(String email)
	{
		if (isOpen()) return true;
		if (email == null) return false;
		String e = email.trim().toLowerCase(Locale.ROOT);
		int at = e.lastIndexOf('@');
		if (at <= 0 || at == e.length() - 1) return false;
		return addresses.contains(e) || domains.contains(e.substring(at + 1));
	}
}
