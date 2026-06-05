from django.urls import path

from .views import GalleryDeleteView, GalleryImageProtectedView, GalleryListCreateView


urlpatterns = [
    path('', GalleryListCreateView.as_view(), name='gallery-list-create'),
    path('<int:image_id>/', GalleryDeleteView.as_view(), name='gallery-delete'),
    path('<int:image_id>/image/', GalleryImageProtectedView.as_view(), name='gallery-protected-image'),
]

