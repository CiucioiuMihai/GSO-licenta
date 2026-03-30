import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { createPost, getTrendingTags, searchTags, getUserDataWithCounts } from '@/services/postsService';
import { Tag, User } from '@/types';
import { auth } from '@/services/firebase';
import { offlineService } from '@/services/offlineService';
import Navbar from '@/components/Navbar';
import { FIRESTORE_IMAGE_LIMITS, prepareImageForPost } from '@/utils/imageUtils';
import { PostImage } from '@/types';

interface CreatePostScreenProps {
  onBack: () => void;
  onPostCreated: () => void;
  onNavigateToHome: () => void;
  onNavigateToFriends: () => void;
  onNavigateToPostsFeed: () => void;
  onNavigateToCreatePost: () => void;
  onNavigateToAchievements: () => void;
  onNavigateToProfile: (userId?: string) => void;
  onNavigateToLeaderboard?: () => void;
}

const { width } = Dimensions.get('window');
const FIRESTORE_SAFE_IMAGE_PAYLOAD_CHARS = 700000;

const getAdaptiveImageLimits = (imageCount: number) => {
  if (imageCount >= 4) {
    return { ...FIRESTORE_IMAGE_LIMITS, maxDimension: 1280, targetMaxBytes: 120 * 1024 };
  }
  if (imageCount === 3) {
    return { ...FIRESTORE_IMAGE_LIMITS, maxDimension: 1400, targetMaxBytes: 150 * 1024 };
  }
  if (imageCount === 2) {
    return { ...FIRESTORE_IMAGE_LIMITS, maxDimension: 1500, targetMaxBytes: 210 * 1024 };
  }
  return { ...FIRESTORE_IMAGE_LIMITS, maxDimension: 1600, targetMaxBytes: 320 * 1024 };
};

const getImageBase64Length = (image: PostImage): number => {
  if (!image?.data) return 0;
  return image.data.startsWith('data:') ? image.data.split(',')[1]?.length || 0 : image.data.length;
};

const CreatePostScreen: React.FC<CreatePostScreenProps> = ({ 
  onBack, 
  onPostCreated,
  onNavigateToHome,
  onNavigateToFriends,
  onNavigateToPostsFeed,
  onNavigateToCreatePost,
  onNavigateToAchievements,
  onNavigateToProfile,
  onNavigateToLeaderboard,
}) => {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [suggestedTags, setSuggestedTags] = useState<Tag[]>([]);
  const [trendingTags, setTrendingTags] = useState<Tag[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [navbarTab, setNavbarTab] = useState('create');
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    // Load trending tags
    const loadTrendingTags = async () => {
      try {
        const trending = await getTrendingTags(20);
        setTrendingTags(trending);
      } catch (error) {
        console.error('Error loading trending tags:', error);
      }
    };

    loadTrendingTags();
  }, []);

  useEffect(() => {
    // Search tags when user types
    const searchForTags = async () => {
      if (tagInput.trim().length > 0) {
        try {
          const results = await searchTags(tagInput.trim());
          setSuggestedTags(results);
          setShowTagSuggestions(true);
        } catch (error) {
          console.error('Error searching tags:', error);
        }
      } else {
        setSuggestedTags([]);
        setShowTagSuggestions(false);
      }
    };

    const timeoutId = setTimeout(searchForTags, 300);
    return () => clearTimeout(timeoutId);
  }, [tagInput]);

  useEffect(() => {
    // Fetch current user data
    const fetchCurrentUser = async () => {
      if (currentUser) {
        const userData = await getUserDataWithCounts(currentUser.uid);
        setCurrentUserData(userData);
      }
    };
    fetchCurrentUser();
  }, [currentUser]);

  const addTag = (tagName: string) => {
    const cleanTag = tagName.trim().toLowerCase();
    if (cleanTag && !tags.includes(cleanTag) && tags.length < 5) {
      setTags([...tags, cleanTag]);
      setTagInput('');
      setShowTagSuggestions(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputSubmit = () => {
    if (tagInput.trim()) {
      addTag(tagInput.trim());
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true, // Request base64 data
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (images.length < 4) {
          const adaptiveLimits = getAdaptiveImageLimits(images.length + 1);
          const postImage = await prepareImageForPost({
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
          }, adaptiveLimits);

          setImages([...images, postImage]);
        } else {
          Alert.alert('Limit Reached', 'You can only add up to 4 images per post.');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleCreatePost = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    if (!content.trim() && images.length === 0) {
      Alert.alert('Empty Post', 'Please add some content or images to your post.');
      return;
    }

    if (content.length > 2000) {
      Alert.alert('Too Long', 'Post content cannot exceed 2000 characters.');
      return;
    }

    setLoading(true);
    try {
      let processedImages = images as PostImage[];
      let estimatedPayloadChars = processedImages.reduce((sum, image) => sum + getImageBase64Length(image), 0);

      // Reprocess all images with stricter limits if payload is too large.
      if (estimatedPayloadChars > FIRESTORE_SAFE_IMAGE_PAYLOAD_CHARS) {
        const strictLimits = getAdaptiveImageLimits(processedImages.length);
        const reprocessed = await Promise.all(
          processedImages.map(async (img) => {
            if (!img.sourceUri) return img;
            return prepareImageForPost({ uri: img.sourceUri, width: img.width, height: img.height }, strictLimits);
          })
        );

        processedImages = reprocessed;
        estimatedPayloadChars = processedImages.reduce((sum, image) => sum + getImageBase64Length(image), 0);
      }

      if (estimatedPayloadChars > FIRESTORE_SAFE_IMAGE_PAYLOAD_CHARS) {
        Alert.alert(
          'Images Too Large',
          'This post is still too large for Firestore. Please remove one image or choose smaller photos.'
        );
        setLoading(false);
        return;
      }

      if (offlineService.isConnected()) {
        await createPost(content.trim(), tags, processedImages);
        Alert.alert('Success', 'Post created successfully!');
      } else {
        await offlineService.createPost(
          currentUser.uid,
          content.trim(),
          tags,
          processedImages.map((image) => image.data)
        );
        Alert.alert('Queued', 'Post saved offline and will sync when internet is back.');
      }

      onPostCreated(); // Navigate immediately after post is created
    } catch (error: any) {
      console.error('Error creating post:', error);
      Alert.alert('Error', error.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const renderTrendingTags = () => (
    <View style={styles.trendingContainer}>
      <Text style={styles.trendingTitle}>Trending Tags</Text>
      <View style={styles.trendingTags}>
        {trendingTags.slice(0, 10).map((tag) => (
          <TouchableOpacity
            key={tag.id}
            style={styles.trendingTag}
            onPress={() => addTag(tag.name)}
          >
            <Text style={styles.trendingTagText}>#{tag.name}</Text>
            <Text style={styles.trendingTagCount}>{tag.postsCount}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const handleNavbarTabPress = (tab: string) => {
    setNavbarTab(tab);
    if (tab === 'explore') {
      onNavigateToFriends();
    } else if (tab === 'posts') {
      onNavigateToPostsFeed();
    } else if (tab === 'home') {
      onNavigateToHome();
    } else if (tab === 'create') {
      // Already on create post screen
    } else if (tab === 'profile') {
      onNavigateToProfile();
    } else if (tab === 'leaderboard') {
      onNavigateToLeaderboard?.();
    }
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Post</Text>
          <TouchableOpacity
            style={[styles.postButton, (!content.trim() && images.length === 0) && styles.postButtonDisabled]}
            onPress={handleCreatePost}
            disabled={loading || (!content.trim() && images.length === 0)}
          >
            <Text style={styles.postButtonText}>
              {loading ? 'Posting...' : 'Post'}
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
        >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Content Input */}
          <View style={styles.contentContainer}>
            <TextInput
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              placeholder="What's on your mind?"
              placeholderTextColor="rgba(255, 255, 255, 0.7)"
              multiline
              maxLength={2000}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>
              {content.length}/2000
            </Text>
          </View>

          {/* Images */}
          {images.length > 0 && (
            <View style={styles.imagesContainer}>
              <View style={styles.imagesGrid}>
                {images.map((image, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image source={{ uri: image.data }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Text style={styles.removeImageText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Add Image Button */}
          <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
            <Text style={styles.addImageText}>📷 Add Images ({images.length}/4)</Text>
          </TouchableOpacity>
          <Text style={styles.imageHintText}>
            Images are auto-optimized to max 1600px and around 350KB each before upload.
          </Text>

          {/* Tags Input */}
          <View style={styles.tagsContainer}>
            <Text style={styles.tagsTitle}>Tags (Optional)</Text>
            <View style={styles.tagInputContainer}>
              <TextInput
                style={styles.tagInput}
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Type a tag and press enter..."
                placeholderTextColor="rgba(255, 255, 255, 0.7)"
                onSubmitEditing={handleTagInputSubmit}
                maxLength={20}
              />
              <TouchableOpacity style={styles.addTagButton} onPress={handleTagInputSubmit}>
                <Text style={styles.addTagButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* Tag Suggestions */}
            {showTagSuggestions && suggestedTags.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {suggestedTags.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    style={styles.suggestion}
                    onPress={() => addTag(tag.name)}
                  >
                    <Text style={styles.suggestionText}>#{tag.name}</Text>
                    <Text style={styles.suggestionCount}>{tag.postsCount} posts</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Selected Tags */}
            {tags.length > 0 && (
              <View style={styles.selectedTags}>
                {tags.map((tag, index) => (
                  <View key={index} style={styles.selectedTag}>
                    <Text style={styles.selectedTagText}>#{tag}</Text>
                    <TouchableOpacity onPress={() => removeTag(tag)}>
                      <Text style={styles.removeTagText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            
            <Text style={styles.tagLimit}>{tags.length}/5 tags</Text>
          </View>

          {/* Trending Tags */}
          {renderTrendingTags()}
        </ScrollView>
        </KeyboardAvoidingView>
        
        {/* Navbar */}
        <Navbar activeTab={navbarTab} onTabPress={handleNavbarTabPress} user={currentUserData} />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 70 : 0,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  postButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 15,
    marginVertical: 15,
  },
  contentInput: {
    color: 'white',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 10,
  },
  imagesContainer: {
    marginVertical: 10,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  imageWrapper: {
    position: 'relative',
  },
  imagePreview: {
    width: (width - 60) / 2,
    height: (width - 60) / 2,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addImageButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 10,
    borderWidth: Platform.OS === 'android' ? 0 : 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'dashed',
  },
  addImageText: {
    color: 'white',
    fontSize: 16,
  },
  imageHintText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    marginBottom: 8,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  tagsContainer: {
    marginVertical: 15,
  },
  tagsTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  tagInputContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 5,
    alignItems: 'center',
  },
  tagInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    paddingVertical: 10,
  },
  addTagButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  addTagButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  suggestionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    marginTop: 5,
    maxHeight: 150,
  },
  suggestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  suggestionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  suggestionCount: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  selectedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  selectedTagText: {
    color: 'white',
    fontSize: 14,
    marginRight: 8,
  },
  removeTagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tagLimit: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 5,
  },
  trendingContainer: {
    marginVertical: 15,
  },
  trendingTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  trendingTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trendingTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendingTagText: {
    color: 'white',
    fontSize: 14,
    marginRight: 5,
  },
  trendingTagCount: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
});

export default CreatePostScreen;