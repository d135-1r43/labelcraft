package net.herhoffer.labeleur.printing;

import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

import jakarta.enterprise.context.ApplicationScoped;
import javax.imageio.ImageIO;
import org.apache.pdfbox.cos.COSDictionary;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.interactive.viewerpreferences.PDViewerPreferences;

/**
 * Turns label rasters into a PDF with one page per label at the label's
 * physical size, for printing through the Brother driver until printers are
 * driven directly. The raster is placed 1:1, so print at 100 %.
 */
@ApplicationScoped
public class PdfRenderer
{

	private static final float POINTS_PER_MM = 72f / 25.4f;

	public byte[] render(String title, PrintJobRequest.Geometry g, List<byte[]> pngs, int copies)
	{
		try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream())
		{
			doc.getDocumentInformation().setTitle(title);
			doc.getDocumentInformation().setCreator("Labeleur");
			// Scaling to fit would shrink the label; the page already is the
			// label.
			PDViewerPreferences prefs = new PDViewerPreferences(new COSDictionary());
			prefs.setPrintScaling(PDViewerPreferences.PRINT_SCALING.None);
			doc.getDocumentCatalog().setViewerPreferences(prefs);

			PDRectangle size = new PDRectangle(pt(g.widthMm()), pt(g.heightMm()));
			float x = pt(g.offsetXMm());
			// PDF measures from the bottom edge.
			float y = pt(g.heightMm() - g.offsetYMm() - g.printableHeightMm());
			float w = pt(g.printableWidthMm());
			float h = pt(g.printableHeightMm());
			for (byte[] png : pngs)
			{
				PDImageXObject image = LosslessFactory.createFromImage(doc, compact(read(png)));
				for (int c = 0; c < copies; c++)
				{
					PDPage page = new PDPage(size);
					doc.addPage(page);
					try (PDPageContentStream cs = new PDPageContentStream(doc, page))
					{
						cs.drawImage(image, x, y, w, h);
					}
				}
			}
			doc.save(out);
			return out.toByteArray();
		}
		catch (IOException e)
		{
			throw new UncheckedIOException(e);
		}
	}

	private static float pt(double mm)
	{
		return (float)(mm * POINTS_PER_MM);
	}

	private static BufferedImage read(byte[] png) throws IOException
	{
		BufferedImage img = ImageIO.read(new ByteArrayInputStream(png));
		if (img == null) throw new IllegalArgumentException("A page is not a readable PNG");
		return img;
	}

	/**
	 * Black and white labels become 1-bit images; two-colour labels keep their
	 * red.
	 */
	private static BufferedImage compact(BufferedImage img)
	{
		for (int yy = 0; yy < img.getHeight(); yy++)
		{
			for (int xx = 0; xx < img.getWidth(); xx++)
			{
				int rgb = img.getRGB(xx, yy);
				int r = (rgb >> 16) & 0xff, gg = (rgb >> 8) & 0xff, b = rgb & 0xff;
				if (Math.abs(r - gg) > 40 || Math.abs(r - b) > 40) return img;
			}
		}
		BufferedImage bw = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_BYTE_BINARY);
		Graphics2D g = bw.createGraphics();
		g.drawImage(img, 0, 0, null);
		g.dispose();
		return bw;
	}
}
