package net.herhoffer.labelcraft.printing;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import net.herhoffer.labelcraft.account.CurrentUser;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;

@ApplicationScoped
public class PrintService
{

	private final PrinterRepository printers;
	private final PrintJobRepository jobs;
	private final PrintDocumentRepository documents;
	private final PdfRenderer pdf;
	private final CurrentUser user;

	PrintService(PrinterRepository printers, PrintJobRepository jobs, PrintDocumentRepository documents, PdfRenderer pdf, CurrentUser user)
	{
		this.user = user;
		this.printers = printers;
		this.jobs = jobs;
		this.documents = documents;
		this.pdf = pdf;
	}

	/**
	 * Records the job with its PDF: rendered here from rasters, or as sent by
	 * the client in vector mode. Printing itself happens through the Brother
	 * driver.
	 *
	 * @param vectorPdf
	 *            the client's PDF, or {@code null} to render {@code pages}
	 */
	@Transactional
	public PrintJob submit(PrintJobRequest req, List<byte[]> pages, byte[] vectorPdf)
	{
		int labels = req.titles().size();
		if (vectorPdf == null && pages.size() != labels) throw new BadRequestException("Expected " + labels + " pages, got " + pages.size());
		if (vectorPdf != null) checkPageCount(vectorPdf, labels * req.copies());
		Printer printer = printers.findById(req.printerId());
		if (printer == null) throw new NotFoundException("No printer " + req.printerId());

		PrintJob job = new PrintJob();
		job.id = UUID.randomUUID();
		job.userId = user.id();
		job.printerId = printer.id;
		job.printerName = printer.name;
		job.mediaId = req.mediaId();
		job.kind = req.kind();
		job.title = labels == 1 ? req.titles().getFirst() : req.titles().getFirst() + " + " + (labels - 1) + " more";
		job.total = labels * req.copies();
		job.mode = (vectorPdf != null ? PrintJob.Mode.vector : PrintJob.Mode.raster).name();
		job.createdAt = Instant.now();
		try
		{
			PrintDocument doc = new PrintDocument();
			doc.jobId = job.id;
			doc.pdf = vectorPdf != null ? vectorPdf : pdf.render(job.title, req.geometry(), pages, req.copies());
			job.printed = job.total;
			job.state = PrintJob.State.done.name();
			jobs.persist(job);
			documents.persist(doc);
		}
		catch (IllegalArgumentException e)
		{
			job.state = PrintJob.State.failed.name();
			job.error = e.getMessage();
			jobs.persist(job);
		}
		return job;
	}

	private static void checkPageCount(byte[] document, int expected)
	{
		try (PDDocument doc = Loader.loadPDF(document))
		{
			if (doc.getNumberOfPages() != expected) throw new BadRequestException("Expected " + expected + " pages in the PDF, got " + doc.getNumberOfPages());
		}
		catch (IOException e)
		{
			throw new BadRequestException("The document is not a readable PDF");
		}
	}

	public List<PrintJob> recent()
	{
		return jobs.recent(user.id(), 20);
	}

	public byte[] pdf(UUID jobId)
	{
		// Someone else's job is as absent as one that never existed.
		PrintDocument doc = jobs.findOwned(user.id(), jobId) == null ? null : documents.findById(jobId);
		if (doc == null) throw new NotFoundException();
		return doc.pdf;
	}
}
