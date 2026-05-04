from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.models.package import Package
from app.schemas.package import PackageWithDocuments

router = APIRouter(prefix="/packages", tags=["packages"])


def _to_dto(pkg: Package) -> PackageWithDocuments:
    return PackageWithDocuments(
        id=pkg.id,
        name=pkg.name,
        tier=pkg.tier,
        price=pkg.price,
        description=pkg.description,
        document_types=[d.document_type for d in pkg.documents],
    )


@router.get("", response_model=list[PackageWithDocuments])
def list_packages(db: Session = Depends(get_db)) -> list[PackageWithDocuments]:
    pkgs = db.scalars(
        select(Package)
        .options(selectinload(Package.documents))
        .order_by(Package.id)
    ).all()
    return [_to_dto(p) for p in pkgs]


@router.get("/{package_id}", response_model=PackageWithDocuments)
def get_package(package_id: int, db: Session = Depends(get_db)) -> PackageWithDocuments:
    pkg = db.scalar(
        select(Package)
        .where(Package.id == package_id)
        .options(selectinload(Package.documents))
    )
    if pkg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="패키지를 찾을 수 없습니다.")
    return _to_dto(pkg)
