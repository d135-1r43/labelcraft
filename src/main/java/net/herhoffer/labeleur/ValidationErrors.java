package net.herhoffer.labeleur;

import java.util.Map;
import java.util.stream.Collectors;

import jakarta.validation.ConstraintViolationException;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.server.ServerExceptionMapper;

/**
 * Invalid input answers 400 with the offending fields, whichever layer noticed.
 */
public class ValidationErrors
{

	public record Problem(String message, Map<String, String> fields)
	{
	}

	@ServerExceptionMapper
	public Response invalid(ConstraintViolationException e)
	{
		Map<String, String> fields = e.getConstraintViolations().stream()
			.collect(Collectors.toMap(v -> lastNode(v.getPropertyPath().toString()), v -> v.getMessage(), (a, b) -> a));
		return Response.status(Response.Status.BAD_REQUEST).entity(new Problem("Some fields are not valid", fields)).build();
	}

	private static String lastNode(String path)
	{
		int dot = path.lastIndexOf('.');
		return dot < 0 ? path : path.substring(dot + 1);
	}
}
