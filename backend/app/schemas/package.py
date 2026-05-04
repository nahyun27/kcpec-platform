from pydantic import BaseModel, ConfigDict

from app.models.package import DocumentType, PackageTier


class PackageItem(BaseModel):
    id: int
    name: str
    tier: PackageTier
    price: int | None
    description: str | None

    model_config = ConfigDict(from_attributes=True)


class PackageWithDocuments(PackageItem):
    document_types: list[DocumentType]
