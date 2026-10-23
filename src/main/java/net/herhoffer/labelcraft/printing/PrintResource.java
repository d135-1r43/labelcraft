package net.herhoffer.labelcraft.printing;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.resteasy.reactive.PartType;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.RestPath;
import org.jboss.resteasy.reactive.multipart.FileUpload;

@Path("/")
@Tag(name = "Printing")
public class PrintResource
{

	/** A job as the queue shows it. {@code createdAt} is epoch milliseconds. */
	public record JobView(String id, String printerId, String printerName, String mediaId, String kind, String title, int total, int printed, String state, String mode, String error, long createdAt, String pdfUrl)
	{

		static JobView of(PrintJob j)
		{
			String pdf = PrintJob.State.done.name().equals(j.state) ? "/api/print-jobs/" + j.id + "/pdf" : null;
			return new JobView(j.id.toString(), j.printerId, j.printerName, j.mediaId, j.kind, j.title, j.total, j.printed, j.state, j.mode, j.error, j.createdAt.toEpochMilli(), pdf);
		}
	}

	private final PrintService printing;
	private final PrinterRepository printers;

	PrintResource(PrintService printing, PrinterRepository printers)
	{
		this.printing = printing;
		this.printers = printers;
	}

	@GET
	@Path("printers")
	@Operation(summary = "Printers and the roll each one has loaded")
	public List<Printer> printers()
	{
		return printers.listAll(io.quarkus.panache.common.Sort.by("name"));
	}

	@GET
	@Path("print-jobs")
	@Operation(summary = "The 20 most recent jobs")
	public List<JobView> jobs()
	{
		return printing.recent().stream().map(JobView::of).toList();
	}

	@POST
	@Path("print-jobs")
	@Consumes(MediaType.MULTIPART_FORM_DATA)
	@Operation(summary = "Submit labels as 300 dpi PNGs in reading orientation (`page`), or as a finished vector PDF (`document`); returns the job with its PDF")
	public JobView submit(@RestForm @PartType(MediaType.APPLICATION_JSON) @Valid @NotNull PrintJobRequest job, @RestForm("page") List<FileUpload> pages, @RestForm("document") FileUpload document)
	{
		List<byte[]> pngs = pages == null ? List.of() : pages.stream().map(PrintResource::bytes).toList();
		return JobView.of(printing.submit(job, pngs, document == null ? null : bytes(document)));
	}

	@GET
	@Path("print-jobs/{id}/pdf")
	@Produces("application/pdf")
	@Operation(summary = "The job's labels as a PDF, one page per label at its physical size")
	public Response pdf(@RestPath UUID id)
	{
		return Response.ok(printing.pdf(id)).header("Content-Disposition", "inline; filename=\"labelcraft-" + id.toString().substring(0, 8) + ".pdf\"").build();
	}

	private static byte[] bytes(FileUpload f)
	{
		try
		{
			return Files.readAllBytes(f.uploadedFile());
		}
		catch (IOException e)
		{
			throw new UncheckedIOException(e);
		}
	}
}
