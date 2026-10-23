package net.herhoffer.labelcraft.printing;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * What the client sends with the label rasters: one title per page, and where
 * the raster sits on the label.
 */
public record PrintJobRequest(
	@NotBlank String printerId,
	@NotBlank String mediaId,
	@NotBlank String kind,
	@Min(1) @Max(99) int copies,
	@NotNull @Size(min = 1, max = 500) List<@NotNull String> titles,
	@NotNull @Valid Geometry geometry)
{

	/**
	 * The physical label in reading orientation, and the printable area the
	 * raster covers. Rasters are 300 dpi, one pixel per printer dot.
	 */
	public record Geometry(
		@Positive double widthMm,
		@Positive double heightMm,
		@PositiveOrZero double offsetXMm,
		@PositiveOrZero double offsetYMm,
		@Positive double printableWidthMm,
		@Positive double printableHeightMm)
	{
	}
}
