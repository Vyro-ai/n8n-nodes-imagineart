// Builds the multipart field map sent to <vag>/image/generations/upload.
// Resolution and count are fixed for the MVP (single 1K image).
export function buildImageForm(p: {
	prompt: string;
	styleId: string;
	variation: string;
	aspectRatio: string;
	orgId: string;
	imageUrl?: string;
	folderId?: string;
}): Record<string, string> {
	const fields: Record<string, string> = {
		prompt: p.prompt,
		style_id: p.styleId,
		variation: p.variation,
		aspect_ratio: p.aspectRatio,
		resolution: '1K',
		count: '1',
		org_id: p.orgId,
	};
	if (p.imageUrl) fields.image_url = p.imageUrl;
	if (p.folderId) fields.parent_id = p.folderId;
	return fields;
}

export function buildVideoForm(p: {
	prompt: string;
	styleId: string;
	variation: string;
	aspectRatio: string;
	duration: string;
	orgId: string;
	resolution?: string;
	imageUrl?: string;
	folderId?: string;
}): Record<string, string> {
	const fields: Record<string, string> = {
		prompt: p.prompt,
		style_id: p.styleId,
		variation: p.variation,
		aspect_ratio: p.aspectRatio,
		count: '1',
		duration: p.duration,
		org_id: p.orgId,
	};
	// resolution is only sent when the model accepts one (resolver returns '' otherwise).
	if (p.resolution) fields.resolution = p.resolution;
	// image_url turns the request into image-to-video for recipes that supply a reference.
	if (p.imageUrl) fields.image_url = p.imageUrl;
	if (p.folderId) fields.parent_id = p.folderId;
	return fields;
}

export function buildMusicForm(p: {
	prompt: string;
	duration: string;
	variation: string;
	orgId: string;
	folderId?: string;
}): Record<string, string> {
	const fields: Record<string, string> = {
		prompt: p.prompt,
		duration: p.duration,
		var: p.variation,
		org_id: p.orgId,
	};
	if (p.folderId) fields.parent_id = p.folderId;
	return fields;
}

// Multipart body with a binary file part (for uploads). Built by hand as a
// Buffer so binary bytes survive, then sent raw with the boundary content-type.
export function buildMultipartWithFile(
	fields: Record<string, string>,
	filePartName: string,
	file: { buffer: Buffer; filename: string; mimeType: string },
): { body: Buffer; contentType: string } {
	const boundary = '----n8nImagineArtFileBoundaryLZ81ewbC0Uu';
	const chunks: Buffer[] = [];
	for (const [name, value] of Object.entries(fields)) {
		chunks.push(
			Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`),
		);
	}
	chunks.push(
		Buffer.from(
			`--${boundary}\r\nContent-Disposition: form-data; name="${filePartName}"; filename="${file.filename}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
		),
	);
	chunks.push(file.buffer);
	chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
	return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

// Serializes simple string fields as a multipart/form-data body. Built by hand
// (fixed boundary, text fields only) so the node stays dependency-free and does
// not rely on the HTTP client correctly serializing a global FormData object.
// A field value may be an array, in which case the field is repeated once per
// element (upstream reads e.g. image_url as a repeated form key).
export function buildMultipartBody(fields: Record<string, string | string[]>): {
	body: string;
	contentType: string;
} {
	const boundary = '----n8nImagineArtFormBoundary7MA4YWxkTrZu0gW';
	const parts = Object.entries(fields)
		.flatMap(([name, value]) =>
			(Array.isArray(value) ? value : [value]).map(
				(v) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${v}\r\n`,
			),
		)
		.join('');
	return {
		body: `${parts}--${boundary}--\r\n`,
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}
