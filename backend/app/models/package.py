import enum

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PackageTier(str, enum.Enum):
    BASIC = "basic"
    STANDARD = "standard"
    PREMIUM = "premium"


class DocumentType(str, enum.Enum):
    CERTIFICATE = "certificate"     # 이수증
    GUIDE = "guide"                 # 양형자료 가이드
    COUNSELING = "counseling"       # 심리상담 의견서
    CBT = "cbt"                     # 인지행동치료(CBT) 자료
    CONSULTATION = "consultation"   # 1:1 상담


class Package(Base):
    __tablename__ = "packages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    tier: Mapped[PackageTier] = mapped_column(
        Enum(PackageTier, name="package_tier", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    documents: Mapped[list["PackageDocument"]] = relationship(
        back_populates="package",
        cascade="all, delete-orphan",
        order_by="PackageDocument.id",
    )


class PackageDocument(Base):
    __tablename__ = "package_documents"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    package_id: Mapped[int] = mapped_column(
        ForeignKey("packages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType, name="package_document_type", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )

    package: Mapped["Package"] = relationship(back_populates="documents")
