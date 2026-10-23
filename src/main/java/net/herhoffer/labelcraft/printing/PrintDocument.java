package net.herhoffer.labelcraft.printing;

import java.util.UUID;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** A job's PDF, apart from the job so lists stay light. */
@Entity
@Table(name = "print_document")
public class PrintDocument extends PanacheEntityBase
{

	@Id
	@Column(name = "job_id")
	public UUID jobId;

	public byte[] pdf;
}
