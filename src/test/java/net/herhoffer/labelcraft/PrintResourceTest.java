package net.herhoffer.labelcraft;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
@TestSecurity(user = "alice")
class PrintResourceTest
{

	/**
	 * DK-11201 read along the feed: 90 × 29 mm label, 991 × 306 dots printable.
	 */
	private static final String JOB = """
		{"printerId": "p-office", "mediaId": "DK-11201", "kind": "address", "copies": 2,
		 "titles": ["Erika Schwarz", "Lea Graf-Imhof"],
		 "geometry": {"widthMm": 90, "heightMm": 29, "offsetXMm": 3.04, "offsetYMm": 1.02, "printableWidthMm": 83.9, "printableHeightMm": 25.9}}
		""";

	@Test
	void listsPrinters()
	{
		given().get("/api/printers").then()
			.statusCode(200)
			.body("id", hasItem("p-office"))
			.body("find { it.id == 'p-store' }.status", equalTo("offline"));
	}

	@Test
	void rendersAJobAsALabelSizedPdf() throws Exception
	{
		String pdfUrl = given().multiPart("job", JOB, "application/json")
			.multiPart("page", "a.png", png(991, 306), "image/png")
			.multiPart("page", "b.png", png(991, 306), "image/png")
			.post("/api/print-jobs").then()
			.statusCode(200)
			.body("state", equalTo("done"))
			.body("mode", equalTo("raster"))
			.body("total", equalTo(4))
			.body("title", equalTo("Erika Schwarz + 1 more"))
			.body("pdfUrl", notNullValue())
			.extract().path("pdfUrl");

		byte[] pdf = given().get(pdfUrl).then().statusCode(200).contentType("application/pdf").extract().asByteArray();
		try (PDDocument doc = Loader.loadPDF(pdf))
		{
			assertThat(doc.getNumberOfPages()).isEqualTo(4);
			PDRectangle box = doc.getPage(0).getMediaBox();
			assertThat(box.getWidth() / 72 * 25.4).isCloseTo(90, org.assertj.core.data.Offset.offset(0.05));
			assertThat(box.getHeight() / 72 * 25.4).isCloseTo(29, org.assertj.core.data.Offset.offset(0.05));
		}
		given().get("/api/print-jobs").then().body("pdfUrl", hasItem(pdfUrl));
	}

	@Test
	void storesAVectorPdfAsSent() throws Exception
	{
		byte[] sent = pdf(4);
		String pdfUrl = given().multiPart("job", JOB, "application/json")
			.multiPart("document", "labels.pdf", sent, "application/pdf")
			.post("/api/print-jobs").then()
			.statusCode(200)
			.body("mode", equalTo("vector"))
			.body("total", equalTo(4))
			.extract().path("pdfUrl");
		assertThat(given().get(pdfUrl).then().statusCode(200).extract().asByteArray()).isEqualTo(sent);

		// Two labels, two copies: a PDF with three pages is not what was asked
		// for.
		given().multiPart("job", JOB, "application/json")
			.multiPart("document", "labels.pdf", pdf(3), "application/pdf")
			.post("/api/print-jobs").then()
			.statusCode(400);
	}

	private static byte[] pdf(int pages) throws Exception
	{
		try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream())
		{
			for (int i = 0; i < pages; i++)
				doc.addPage(new org.apache.pdfbox.pdmodel.PDPage(new PDRectangle(255, 82)));
			doc.save(out);
			return out.toByteArray();
		}
	}

	@Test
	void rejectsMismatchedPagesAndUnknownPrinters()
	{
		given().multiPart("job", JOB, "application/json")
			.multiPart("page", "a.png", png(10, 10), "image/png")
			.post("/api/print-jobs").then()
			.statusCode(400);
		given().multiPart("job", JOB.replace("p-office", "p-nowhere"), "application/json")
			.multiPart("page", "a.png", png(10, 10), "image/png")
			.multiPart("page", "b.png", png(10, 10), "image/png")
			.post("/api/print-jobs").then()
			.statusCode(404);
	}

	private static byte[] png(int w, int h)
	{
		try
		{
			BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
			Graphics2D g = img.createGraphics();
			g.setColor(Color.WHITE);
			g.fillRect(0, 0, w, h);
			g.setColor(Color.BLACK);
			g.fillRect(w / 4, h / 4, w / 2, h / 2);
			g.dispose();
			ByteArrayOutputStream out = new ByteArrayOutputStream();
			ImageIO.write(img, "png", out);
			return out.toByteArray();
		}
		catch (Exception e)
		{
			throw new RuntimeException(e);
		}
	}
}
