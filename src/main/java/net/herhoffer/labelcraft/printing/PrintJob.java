package net.herhoffer.labelcraft.printing;

import java.time.Instant;
import java.util.UUID;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "print_job")
public class PrintJob extends PanacheEntityBase
{

	public enum Mode
	{
		/** 300 dpi rasters placed by the server, exactly as previewed. */
		raster,
		/** Outlines from the client; the driver rasterizes. */
		vector
	}

	public enum State
	{
		queued, printing, done, failed
	}

	@Id
	public UUID id;
	/** The user who printed it. */
	public String userId;
	@Column(name = "printer_id")
	public String printerId;
	@Column(name = "printer_name")
	public String printerName;
	@Column(name = "media_id")
	public String mediaId;
	/** The label kind: address, asset, location, food, text. */
	public String kind;
	public String title;
	/** Labels in the job, copies included. */
	public int total;
	public int printed;
	@Column(name = "state")
	public String state;
	public String error;
	@Column(name = "render_mode")
	public String mode;
	@Column(name = "created_at")
	public Instant createdAt;
}
